import { Hono } from "hono";
import { count, eq } from "drizzle-orm";
import db from "../../db";
import { tags, snippetsToTags } from "../../db/schema";

export const publicTags = new Hono().get("/", async (c) => {
  const [all, counts] = await Promise.all([
    db.select().from(tags).all(),
    db
      .select({ tagId: snippetsToTags.tagId, count: count() })
      .from(snippetsToTags)
      .groupBy(snippetsToTags.tagId)
      .all(),
  ]);
  const countMap = new Map(counts.map((r) => [r.tagId, r.count]));
  const items = all.map((t) => ({ ...t, snippetCount: countMap.get(t.id) ?? 0 }));
  return c.json({ items });
});
