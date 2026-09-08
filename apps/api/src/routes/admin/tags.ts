import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { count, eq } from "drizzle-orm";
import { tagSchema } from "@murmur/api-types";
import db from "../../db";
import { tags, snippetsToTags } from "../../db/schema";

async function slugExists(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).all();
  return rows.some((r) => r.id !== excludeId);
}

export const adminTags = new Hono()
  .get("/", async (c) => {
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
  })
  .post("/", zValidator("json", tagSchema), async (c) => {
    const body = c.req.valid("json");
    if (await slugExists(body.slug)) {
      return c.json({ error: "slug 已存在" }, 409);
    }
    const [tag] = await db
      .insert(tags)
      .values({
        slug: body.slug,
        name: body.name,
        description: body.description ?? null,
        color: body.color ?? null,
      })
      .returning();
    return c.json(tag, 201);
  })
  .put("/:id", zValidator("json", tagSchema.partial()), async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "无效的 id" }, 400);
    const body = c.req.valid("json");

    if (body.slug && (await slugExists(body.slug, id))) {
      return c.json({ error: "slug 已存在" }, 409);
    }

    const [tag] = await db
      .update(tags)
      .set({
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
      })
      .where(eq(tags.id, id))
      .returning();

    if (!tag) return c.json({ error: "Not Found" }, 404);
    return c.json(tag);
  })
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "无效的 id" }, 400);

    await db.delete(snippetsToTags).where(eq(snippetsToTags.tagId, id));
    const deleted = await db.delete(tags).where(eq(tags.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: "Not Found" }, 404);
    return c.json({ success: true });
  });
