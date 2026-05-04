import app from "./app";
import { createDb } from "./db/client";
import { CollabSessionRepo } from "./db/repositories/collab-session.repo";
import { ViewRepo } from "./db/repositories/view.repo";

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
 * - Cleans up view records older than 90 days
 */
export const scheduled: ExportedHandlerScheduledHandler = async (controller, env, _ctx) => {
  const d1 = (env as Record<string, unknown>).DB as D1Database;
  if (!d1) return;

  const db = createDb(d1);
  const sessionRepo = new CollabSessionRepo(db);

  // Deactivate expired sessions
  const deactivated = await sessionRepo.deactivateExpired();

  // Delete inactive sessions older than 24 hours
  await sessionRepo.deleteOldInactive();

  // Clean up view records older than 90 days
  const viewRepo = new ViewRepo(db);
  const cleanedViews = await viewRepo.cleanOldViews(90);

  console.log(
    `[cron:${controller.scheduledTime}] Cleanup: deactivated ${deactivated} expired sessions, cleaned ${cleanedViews} old view records`,
  );
};
