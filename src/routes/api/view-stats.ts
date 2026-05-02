import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { requireAdmin } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { ViewTrackerService } from "@/services/view-tracker.service";
import { notes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface SyncRequestBody {
  data: Array<{ slug: string; views: number }>;
}

const app = new Hono<Env>();

/**
 * POST /api/admin/view-stats/sync — Sync view counts from Cloudflare Analytics.
 *
 * Expects a JSON body: { "data": [{ "slug": "my-post", "views": 1234 }, ...] }
 *
 * The caller (admin or CI job) fetches pageview data from the Cloudflare GraphQL Analytics API
 * and posts it here. This endpoint maps slugs to notes and updates view counts.
 */
app.post("/sync", requireAdmin, async (c) => {
  const body = await c.req.json<SyncRequestBody>();

  if (!body?.data || !Array.isArray(body.data)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid data format" } }, 400);
  }

  const db = createDb(c.env.DB);
  const viewTracker = new ViewTrackerService(db);
  const updated = await viewTracker.batchSetViewCounts(body.data);

  return c.json({ data: { updated, total: body.data.length } });
});

/**
 * GET /api/admin/view-stats — Get current view counts for all published notes.
 */
app.get("/", requireAdmin, async (c) => {
  const db = createDb(c.env.DB);

  const result = await db
    .select({ id: notes.id, title: notes.title, slug: notes.slug, viewCount: notes.viewCount })
    .from(notes)
    .where(eq(notes.status, "published"))
    .orderBy(desc(notes.viewCount))
    .limit(100);

  return c.json({ data: { notes: result } });
});

export default app;
