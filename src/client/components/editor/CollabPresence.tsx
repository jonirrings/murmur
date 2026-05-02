import { useTranslation } from "react-i18next";

interface CollabPresenceProps {
  isConnected: boolean;
  participants: Array<{
    clientId: number;
    name: string;
    color: string;
  }>;
  wsLatency: number | null;
  rtcLatency: number | null;
  isP2P: boolean;
}

function latencyColor(ms: number): string {
  if (ms < 50) return "bg-green-500";
  if (ms <= 150) return "bg-yellow-500";
  return "bg-red-500";
}

export function CollabPresence({
  isConnected,
  participants,
  wsLatency,
  rtcLatency,
  isP2P,
}: CollabPresenceProps) {
  const { t } = useTranslation("editor");

  const displayLatency = isP2P && rtcLatency !== null ? rtcLatency : wsLatency;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {participants.map((p) => (
          <div
            key={p.clientId}
            title={p.name}
            className="h-6 w-6 rounded-full flex items-center justify-center text-xs text-white font-medium ring-2 ring-white dark:ring-gray-800"
            style={{ backgroundColor: p.color }}
          >
            {p.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      {participants.length > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t("collab.collaborating", { count: participants.length })}
        </span>
      )}
      <span
        className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-300"}`}
        title={isConnected ? t("collab.connected") : t("collab.disconnected")}
      />
      {isConnected && displayLatency !== null && (
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <span className={`h-1.5 w-1.5 rounded-full ${latencyColor(displayLatency)}`} />
          {displayLatency}ms
        </span>
      )}
      {isP2P && (
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
          P2P
        </span>
      )}
    </div>
  );
}
