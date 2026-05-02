import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { Extension } from "@codemirror/state";

interface Participant {
  clientId: number;
  name: string;
  color: string;
}

interface UseCollabEditorResult {
  collabExtensions: Array<Extension>;
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  participants: Participant[];
  isP2P: boolean;
  wsLatency: number | null;
  rtcLatency: number | null;
}

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const PEER_THRESHOLD_FOR_WEBRTC = 2;
const LATENCY_PING_INTERVAL = 15000;

/**
 * Hook for Yjs collaboration with CodeMirror binding.
 * Creates a single Y.Doc and WebsocketProvider, returns extensions for y-codemirror.next.
 * Also tracks participants via awareness for presence display.
 * Auto-upgrades to WebRTC P2P when 2+ peers, falls back to WebSocket on disconnect.
 * Measures WebSocket and WebRTC latency.
 */
export function useCollabEditor(noteId: string | null, userName?: string): UseCollabEditorResult {
  const [isConnected, setIsConnected] = useState(false);
  const [collabExtensions, setCollabExtensions] = useState<Array<Extension>>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isP2P, setIsP2P] = useState(false);
  const [wsLatency, setWsLatency] = useState<number | null>(null);
  const [rtcLatency, setRtcLatency] = useState<number | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const rtcProviderRef = useRef<InstanceType<typeof import("y-webrtc").WebrtcProvider> | null>(
    null,
  );

  const maybeCreateWebRTC = useCallback(
    (wsProvider: WebsocketProvider, doc: Y.Doc, nId: string) => {
      if (rtcProviderRef.current) return;

      const peerCount = wsProvider.awareness.getStates().size;
      if (peerCount < PEER_THRESHOLD_FOR_WEBRTC) return;

      import("y-webrtc")
        .then(({ WebrtcProvider }) => {
          if (rtcProviderRef.current) return;
          if (wsProvider.awareness.getStates().size < PEER_THRESHOLD_FOR_WEBRTC) return;

          const wsUrl = `${window.location.origin}/api/collab/ws?noteId=${nId}&role=editor`;

          const rtcProvider = new WebrtcProvider(`note:${nId}`, doc, {
            signaling: [wsUrl],
            awareness: wsProvider.awareness,
            maxConns: 20,
            filterBcConns: true,
            peerOpts: {
              config: {
                iceServers: [
                  { urls: "stun:stun.cloudflare.com:3478" },
                  { urls: "stun:stun.hitv.com:3478" },
                  { urls: "stun:stun.miwifi.com:3478" },
                  { urls: "stun:stun.qq.com:3478" },
                  { urls: "stun:stun.syncthing.net:3478" },
                ],
              },
            },
          });

          rtcProviderRef.current = rtcProvider;
          setIsP2P(true);
        })
        .catch((err) => {
          console.warn("Failed to create WebRTC provider:", err);
        });
    },
    [],
  );

  const maybeDestroyWebRTC = useCallback(() => {
    if (!rtcProviderRef.current) return;
    rtcProviderRef.current.destroy();
    rtcProviderRef.current = null;
    setIsP2P(false);
    setRtcLatency(null);
  }, []);

  useEffect(() => {
    if (!noteId) {
      setCollabExtensions([]);
      setParticipants([]);
      return;
    }

    const doc = new Y.Doc();
    docRef.current = doc;

    const wsUrl = `${window.location.origin}/api/collab/ws?noteId=${noteId}&role=editor`;

    const provider = new WebsocketProvider(wsUrl, `note:${noteId}`, doc, {
      connect: true,
    });
    providerRef.current = provider;

    if (userName) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      provider.awareness.setLocalStateField("user", { name: userName, color });
    }

    provider.on("status", ({ status }: { status: string }) => {
      setIsConnected(status === "connected");
    });

    // Track participants via awareness and auto-switch WebRTC
    const awareness = provider.awareness;
    const updateParticipants = () => {
      const states = awareness.getStates();
      const list: Participant[] = [];
      states.forEach((state, clientId) => {
        if (clientId !== awareness.clientID) {
          list.push({
            clientId,
            name: (state.user?.name as string) || "Anonymous",
            color: (state.user?.color as string) || COLORS[clientId % COLORS.length],
          });
        }
      });
      setParticipants(list);

      if (states.size >= PEER_THRESHOLD_FOR_WEBRTC) {
        maybeCreateWebRTC(provider, doc, noteId);
      }
    };

    awareness.on("change", updateParticipants);

    // Listen for WebRTC peer disconnects to fall back
    const checkWebRTCFallback = () => {
      if (rtcProviderRef.current) {
        const rtcConns = (rtcProviderRef.current as unknown as { conns: Map<unknown, unknown> })
          .conns;
        const wsPeerCount = awareness.getStates().size;
        if (rtcConns && rtcConns.size === 0 && wsPeerCount < PEER_THRESHOLD_FOR_WEBRTC) {
          maybeDestroyWebRTC();
        }
      }
    };

    const fallbackInterval = setInterval(checkWebRTCFallback, 10000);

    // WebSocket latency measurement: send ping, listen for pong
    const wsPingInterval = setInterval(() => {
      const ws = provider.ws as WebSocket | null;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "latency-ping", ts: Date.now() }));
      }
    }, LATENCY_PING_INTERVAL);

    const handleWsMessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "latency-pong" && typeof msg.ts === "number") {
            setWsLatency(Math.round(Date.now() - msg.ts));
          }
        } catch {
          // Not a JSON message, ignore
        }
      }
    };

    const ws = provider.ws as WebSocket | null;
    if (ws) {
      ws.addEventListener("message", handleWsMessage);
    } else {
      // Wait for connection, then attach listener
      provider.on("status", function onStatus({ status }: { status: string }) {
        if (status === "connected") {
          const currentWs = provider.ws as WebSocket | null;
          if (currentWs) {
            currentWs.addEventListener("message", handleWsMessage);
          }
          provider.off("status", onStatus);
        }
      });
    }

    // WebRTC latency measurement: poll RTCPeerConnection stats
    const rtcStatsInterval = setInterval(() => {
      if (!rtcProviderRef.current) return;

      try {
        const webrtcConns = (
          rtcProviderRef.current as unknown as {
            webrtcConns?: Map<string, { peer?: RTCPeerConnection }>;
          }
        ).webrtcConns;
        if (!webrtcConns) return;

        for (const conn of webrtcConns.values()) {
          if (conn.peer) {
            conn.peer
              .getStats()
              .then((stats) => {
                for (const stat of stats.values()) {
                  if (
                    stat.type === "candidate-pair" &&
                    stat.state === "succeeded" &&
                    typeof stat.currentRoundTripTime === "number"
                  ) {
                    setRtcLatency(Math.round(stat.currentRoundTripTime * 1000));
                    break;
                  }
                }
              })
              .catch(() => {
                // Stats may not be available
              });
            break; // Only need the first connection's stats
          }
        }
      } catch {
        // RTCPeerConnection stats not available
      }
    }, LATENCY_PING_INTERVAL);

    // Dynamically import y-codemirror.next to get extensions
    void import("y-codemirror.next").then(({ yCollab }) => {
      const yText = doc.getText("content");
      const undoManager = new Y.UndoManager(yText);

      const extensions = yCollab(yText, provider.awareness, {
        undoManager,
      });

      setCollabExtensions(extensions as Extension[]);
    });

    return () => {
      clearInterval(fallbackInterval);
      clearInterval(wsPingInterval);
      clearInterval(rtcStatsInterval);
      if (ws) {
        ws.removeEventListener("message", handleWsMessage);
      }
      setCollabExtensions([]);
      awareness.off("change", updateParticipants);
      maybeDestroyWebRTC();
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      setIsConnected(false);
      setParticipants([]);
      setIsP2P(false);
      setWsLatency(null);
      setRtcLatency(null);
    };
  }, [noteId, userName, maybeCreateWebRTC, maybeDestroyWebRTC]);

  return {
    collabExtensions,
    doc: docRef.current,
    provider: providerRef.current,
    isConnected,
    participants,
    isP2P,
    wsLatency,
    rtcLatency,
  };
}
