import * as Y from "yjs";

interface ClientAttachment {
  noteId: string;
  role: "editor" | "viewer";
  signalingTopics: Set<string>;
}

const PERSIST_DEBOUNCE_MS = 5000;
const MAX_ROOM_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// y-websocket protocol message types
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_SYNC_STEP_1 = 0;
const MSG_SYNC_STEP_2 = 1;
const MSG_SYNC_UPDATE = 2;

/**
 * CollaborationRoomDO — manages Yjs documents for real-time collaboration.
 *
 * Uses y-websocket protocol for compatibility with y-codemirror.next:
 * - Sync step 1: server sends state vector to client
 * - Sync step 2: client sends missing state to server
 * - Update: client/server broadcast incremental updates
 *
 * Role-based access:
 * - editor: can send updates (write)
 * - viewer: receives updates only (read-only)
 *
 * HTTP endpoints:
 * - GET /info?noteId= — room info
 * - GET /join?noteId=&role= — join room
 * - GET /leave?noteId= — leave room
 */
export class CollaborationRoomDO implements DurableObject {
  private state: DurableObjectState;
  private env: { DB: D1Database };
  private rooms: Map<string, Y.Doc> = new Map();
  private lastPersisted: Map<string, number> = new Map();
  private dirtyRooms: Set<string> = new Set();
  private persistTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.env = env as { DB: D1Database };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(url);
    }

    switch (url.pathname) {
      case "/info":
        return this.handleInfo(url);
      case "/join":
        return this.handleJoin(url);
      case "/leave":
        return this.handleLeave(url);
      case "/cleanup":
        return this.handleCleanup();
      default:
        return new Response("Not found", { status: 404 });
    }
  }

  private async handleWebSocket(url: URL): Promise<Response> {
    const noteId = url.searchParams.get("noteId");
    if (!noteId) {
      return new Response("Missing noteId", { status: 400 });
    }

    const role = url.searchParams.get("role") === "viewer" ? "viewer" : "editor";

    const doc = await this.getOrCreateDoc(noteId);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      noteId,
      role,
      signalingTopics: new Set<string>(),
    } satisfies ClientAttachment);

    // Send sync step 1: state vector
    const stateVector = Y.encodeStateVector(doc);
    const syncStep1 = this.encodeSyncMessage(MSG_SYNC_STEP_1, stateVector);
    server.send(syncStep1);

    // Schedule alarm for cleanup
    void this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as ClientAttachment | null;
    if (!attachment?.noteId) return;

    // String messages are signaling (JSON); binary messages are y-websocket protocol
    if (typeof message === "string") {
      this.handleSignalingMessage(ws, attachment, message);
      return;
    }

    // Viewers cannot write
    if (attachment.role === "viewer") return;

    const doc = this.rooms.get(attachment.noteId);
    if (!doc) return;

    try {
      const data = new Uint8Array(message);

      if (data.length === 0) return;

      const msgType = data[0];

      if (msgType === MSG_SYNC) {
        const decoder = data.subarray(1);
        if (decoder.length === 0) return;

        const syncType = decoder[0];
        const payload = decoder.subarray(1);

        if (syncType === MSG_SYNC_STEP_1) {
          // Client sent state vector, reply with missing state
          const clientStateVector = payload;
          const missingUpdate = Y.encodeStateAsUpdate(doc, clientStateVector);
          if (missingUpdate.length > 2) {
            const reply = this.encodeSyncMessage(MSG_SYNC_STEP_2, missingUpdate);
            ws.send(reply);
          }
        } else if (syncType === MSG_SYNC_STEP_2) {
          // Client sent missing state — apply it
          Y.applyUpdate(doc, payload);
          this.dirtyRooms.add(attachment.noteId);
          this.schedulePersist(attachment.noteId);
          this.broadcastToRoom(attachment.noteId, message, ws);
        } else if (syncType === MSG_SYNC_UPDATE) {
          // Client sent incremental update — apply it
          Y.applyUpdate(doc, payload);
          this.dirtyRooms.add(attachment.noteId);
          this.schedulePersist(attachment.noteId);
          this.broadcastToRoom(attachment.noteId, message, ws);
        }
      } else if (msgType === MSG_AWARENESS) {
        // Awareness message — relay to all other clients in the room
        this.broadcastToRoom(attachment.noteId, message, ws);
      }
    } catch (err) {
      console.error("Failed to process Yjs message:", err);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as ClientAttachment | null;
    if (attachment?.noteId) {
      this.dirtyRooms.add(attachment.noteId);
      this.schedulePersist(attachment.noteId);
    }
  }

  // --- Signaling relay for y-webrtc ---

  private handleSignalingMessage(
    ws: WebSocket,
    attachment: ClientAttachment,
    message: string,
  ): void {
    try {
      const msg = JSON.parse(message) as {
        type: string;
        topics?: string[];
        topic?: string;
        data?: unknown;
        ts?: number;
      };

      switch (msg.type) {
        case "subscribe":
          if (msg.topics && Array.isArray(msg.topics)) {
            for (const topic of msg.topics) {
              attachment.signalingTopics.add(topic);
            }
            ws.serializeAttachment(attachment);
          }
          break;

        case "unsubscribe":
          if (msg.topics && Array.isArray(msg.topics)) {
            for (const topic of msg.topics) {
              attachment.signalingTopics.delete(topic);
            }
            ws.serializeAttachment(attachment);
          }
          break;

        case "publish":
          if (msg.topic && msg.data !== undefined) {
            this.relaySignalingMessage(msg.topic, message, ws);
          }
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        case "latency-ping":
          ws.send(JSON.stringify({ type: "latency-pong", ts: msg.ts }));
          break;
      }
    } catch (err) {
      console.error("Failed to process signaling message:", err);
    }
  }

  private relaySignalingMessage(topic: string, message: string, sender: WebSocket): void {
    const clients = this.state.getWebSockets().filter((ws) => {
      if (ws === sender) return false;
      const a = ws.deserializeAttachment() as ClientAttachment | null;
      return a?.signalingTopics?.has(topic) ?? false;
    });

    for (const client of clients) {
      try {
        client.send(message);
      } catch {
        // Client disconnected
      }
    }
  }

  private handleInfo(url: URL): Response {
    const noteId = url.searchParams.get("noteId");
    if (!noteId) {
      return Response.json({ error: "Missing noteId" }, { status: 400 });
    }

    const clients = this.state.getWebSockets().filter((ws) => {
      const a = ws.deserializeAttachment() as ClientAttachment | null;
      return a?.noteId === noteId;
    });

    return Response.json({
      noteId,
      activeConnections: clients.length,
      editors: clients.filter((ws) => {
        const a = ws.deserializeAttachment() as ClientAttachment | null;
        return a?.role === "editor";
      }).length,
      viewers: clients.filter((ws) => {
        const a = ws.deserializeAttachment() as ClientAttachment | null;
        return a?.role === "viewer";
      }).length,
    });
  }

  private handleJoin(url: URL): Response {
    const noteId = url.searchParams.get("noteId");
    if (!noteId) {
      return Response.json({ error: "Missing noteId" }, { status: 400 });
    }
    return Response.json({ ok: true, noteId });
  }

  private handleLeave(_url: URL): Response {
    return Response.json({ ok: true });
  }

  private async handleCleanup(): Promise<Response> {
    await this.persistAllDirtyRooms();
    return Response.json({ ok: true });
  }

  // --- y-websocket protocol encoding ---

  private encodeSyncMessage(syncType: number, data: Uint8Array): Uint8Array {
    // Format: [MSG_SYNC, syncType, ...data]
    const result = new Uint8Array(2 + data.length);
    result[0] = MSG_SYNC;
    result[1] = syncType;
    result.set(data, 2);
    return result;
  }

  // --- Room management ---

  private async getOrCreateDoc(noteId: string): Promise<Y.Doc> {
    const existing = this.rooms.get(noteId);
    if (existing) return existing;

    const doc = new Y.Doc();
    this.rooms.set(noteId, doc);
    this.lastPersisted.set(noteId, 0);

    // Load persisted state
    await this.loadPersistedState(noteId, doc);

    return doc;
  }

  private async loadPersistedState(noteId: string, doc: Y.Doc): Promise<void> {
    try {
      const stored = await this.state.storage.get<Uint8Array>(`yjs:${noteId}`);
      if (stored) {
        Y.applyUpdate(doc, stored);
        this.lastPersisted.set(noteId, Date.now());
      }
    } catch {
      // No persisted state — start fresh
    }
  }

  private broadcastToRoom(noteId: string, message: string | ArrayBuffer, sender: WebSocket): void {
    const clients = this.state.getWebSockets().filter((ws) => {
      if (ws === sender) return false;
      const a = ws.deserializeAttachment() as ClientAttachment | null;
      return a?.noteId === noteId;
    });

    for (const client of clients) {
      try {
        client.send(message);
      } catch {
        // Client disconnected
      }
    }
  }

  private schedulePersist(noteId: string): void {
    const existing = this.persistTimers.get(noteId);
    if (existing) clearTimeout(existing);

    this.persistTimers.set(
      noteId,
      setTimeout(() => {
        void this.persistRoom(noteId);
      }, PERSIST_DEBOUNCE_MS),
    );
  }

  private async persistRoom(noteId: string): Promise<void> {
    const doc = this.rooms.get(noteId);
    if (!doc || !this.dirtyRooms.has(noteId)) return;

    try {
      const update = Y.encodeStateAsUpdate(doc);
      await this.state.storage.put(`yjs:${noteId}`, update);
      this.lastPersisted.set(noteId, Date.now());
      this.dirtyRooms.delete(noteId);

      // Also persist Markdown to D1 if DB is available
      await this.persistMarkdownToD1(noteId, doc);
    } catch (err) {
      console.error(`Failed to persist room ${noteId}:`, err);
    }
  }

  private async persistMarkdownToD1(noteId: string, doc: Y.Doc): Promise<void> {
    try {
      if (!this.env.DB) return;
      // eslint-disable-next-line typescript-eslint/no-base-to-string -- Y.Text.toString() returns text content
      const content = doc.getText("content").toString();
      if (!content.trim()) return;

      await this.env.DB.prepare("UPDATE notes SET content = ?, updated_at = ? WHERE id = ?")
        .bind(content, new Date().toISOString(), noteId)
        .run();
    } catch (err) {
      console.error(`Failed to persist markdown for ${noteId}:`, err);
    }
  }

  private async persistAllDirtyRooms(): Promise<void> {
    for (const noteId of this.dirtyRooms) {
      await this.persistRoom(noteId);
    }
  }

  async alarm(): Promise<void> {
    // Persist all dirty rooms
    await this.persistAllDirtyRooms();

    // Clean up stale rooms
    const now = Date.now();
    for (const [noteId, doc] of this.rooms) {
      const clients = this.state.getWebSockets().filter((ws) => {
        const a = ws.deserializeAttachment() as ClientAttachment | null;
        return a?.noteId === noteId;
      });
      const lastPersisted = this.lastPersisted.get(noteId) ?? 0;
      if (clients.length === 0 && lastPersisted > 0 && now - lastPersisted > MAX_ROOM_AGE_MS) {
        doc.destroy();
        this.rooms.delete(noteId);
        this.lastPersisted.delete(noteId);
        this.dirtyRooms.delete(noteId);
        this.persistTimers.delete(noteId);
      }
    }

    // Reschedule alarm if there are active connections
    if (this.state.getWebSockets().length > 0) {
      void this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
    }
  }
}
