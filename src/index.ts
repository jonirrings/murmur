import app from "./app";
import { createDb } from "./db/client";
import { CollabSessionRepo } from "./db/repositories/collab-session.repo";

export default app;
export { CollaborationRoomDO } from "./do/collaboration-room.do";
export { RateLimiterDO } from "./do/rate-limiter.do";
export { VisitorCounterDO } from "./do/visitor-counter.do";

/**
 * Cloudflare Cron Trigger handler.
 * Runs every 30 minutes to clean up expired data.
 *
 * - Deactivates expired collab sessions
 * - Deletes inactive sessions older than 24 hours
 */
export const scheduled: ExportedHandlerScheduledHandler = async (controller, env, _ctx) => {
  const d1 = (env as Record<string, unknown>).DB as D1Database;
  if (!d1) return;

  const sessionRepo = new CollabSessionRepo(createDb(d1));

  // Deactivate expired sessions
  const deactivated = await sessionRepo.deactivateExpired();

  // Delete inactive sessions older than 24 hours
  await sessionRepo.deleteOldInactive();

  console.log(
    `[cron:${controller.scheduledTime}] Cleanup: deactivated ${deactivated} expired sessions`,
  );
};
