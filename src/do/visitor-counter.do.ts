/**
 * VisitorCounterDO — tracks real-time online visitor counts per page via WebSocket.
 *
 * Uses a single global instance (idFromName("global")) to track all pages.
 * Each WebSocket connection is tagged with a pageKey via deserializeAttachment.
 *
 * Protocol:
 * - Client connects: GET /ws?pageKey=<encoded page key>
 * - Server sends: JSON { "type": "count", "pageKey": "...", "count": N }
 * - On connect/disconnect, all clients on the same pageKey receive updated count
 * - HTTP: GET /counts → { [pageKey]: number }
 * - HTTP: GET /count?pageKey= → { pageKey, count }
 */

interface ClientAttachment {
  pageKey: string;
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class VisitorCounterDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(url);
    }

    switch (url.pathname) {
      case "/counts":
        return this.handleCounts();
      case "/count":
        return this.handleCount(url);
      case "/cleanup":
        return this.handleCleanup();
      default:
        return new Response("Not found", { status: 404 });
    }
  }

  private handleWebSocket(url: URL): Response {
    const pageKey = url.searchParams.get("pageKey") || "/";

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ pageKey } satisfies ClientAttachment);

    // Schedule alarm for cleanup
    void this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);

    // Send current count to the new client
    const count = this.getPageCount(pageKey);
    server.send(JSON.stringify({ type: "count", pageKey, count }));

    // Broadcast updated count to all clients on this page
    this.broadcastPageCount(pageKey);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {
    // Presence-only — no message handling needed
    // Clients just keep the connection open
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as ClientAttachment | null;
    if (attachment?.pageKey) {
      this.broadcastPageCount(attachment.pageKey);
    }
  }

  private handleCounts(): Response {
    const counts = this.getAllCounts();
    return Response.json(counts);
  }

  private handleCount(url: URL): Response {
    const pageKey = url.searchParams.get("pageKey") || "/";
    const count = this.getPageCount(pageKey);
    return Response.json({ pageKey, count });
  }

  private async handleCleanup(): Promise<Response> {
    await this.cleanup();
    return Response.json({ ok: true });
  }

  private getPageCount(pageKey: string): number {
    return this.state.getWebSockets().filter((ws) => {
      const attachment = ws.deserializeAttachment() as ClientAttachment | null;
      return attachment?.pageKey === pageKey;
    }).length;
  }

  private getAllCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as ClientAttachment | null;
      const key = attachment?.pageKey || "/";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  private broadcastPageCount(pageKey: string): void {
    const count = this.getPageCount(pageKey);
    const message = JSON.stringify({ type: "count", pageKey, count });

    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as ClientAttachment | null;
      if (attachment?.pageKey === pageKey) {
        try {
          ws.send(message);
        } catch {
          // Client disconnected
        }
      }
    }
  }

  async alarm(): Promise<void> {
    const webSockets = this.state.getWebSockets();
    if (webSockets.length === 0) {
      // No active connections — no need for alarm
      return;
    }
    // Reschedule alarm for continued cleanup
    void this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
  }

  private async cleanup(): Promise<void> {
    // Close stale connections (already closed but not cleaned up by runtime)
    // The hibernation API handles this automatically via webSocketClose,
    // but we can force-check by iterating and verifying
    const webSockets = this.state.getWebSockets();
    for (const ws of webSockets) {
      // ReadyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
      if (ws.readyState === 3) {
        // Already closed — the runtime should have called webSocketClose,
        // but we broadcast just in case
        const attachment = ws.deserializeAttachment() as ClientAttachment | null;
        if (attachment?.pageKey) {
          this.broadcastPageCount(attachment.pageKey);
        }
      }
    }
  }
}
