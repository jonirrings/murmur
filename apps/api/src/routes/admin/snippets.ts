import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { snippetSchema, snippetStatusSchema } from "@murmur/api-types";
import db from "../../db";
import { snippets, snippetsToTags } from "../../db/schema";
import {
  getSnippetTags,
  makeExcerpt,
  querySnippets,
  replaceSnippetTags,
  slugify,
  uniqueSlug,
} from "../../lib/snippets";
import type { AppEnv } from "../../types";

export const adminSnippets = new Hono<AppEnv>()
  .get("/", async (c) => {
    const page = Number(c.req.query("page") ?? 1);
    const pageSize = Number(c.req.query("pageSize") ?? 10);
    const result = await querySnippets({ page, pageSize });
    return c.json(result);
  })
  .post("/", zValidator("json", snippetSchema), async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session")!;

    const slug = await uniqueSlug(body.slug?.trim() || slugify(body.title));
    const excerpt = body.excerpt ?? makeExcerpt(body.contentMd);
    const publishedAt =
      body.publishedAt ?? (body.status === "published" ? new Date().toISOString() : null);

    const [created] = await db
      .insert(snippets)
      .values({
        slug,
        title: body.title,
        contentMd: body.contentMd,
        excerpt,
        language: body.language ?? null,
        coverImage: body.coverImage ?? null,
        status: body.status,
        visibility: body.visibility,
        authorId: session.user.id,
        publishedAt,
      })
      .returning();

    await replaceSnippetTags(created.id, body.tagIds);
    const tags = await getSnippetTags(created.id);

    return c.json({ ...created, tags }, 201);
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "无效的 id" }, 400);

    const row = await db.select().from(snippets).where(eq(snippets.id, id)).get();
    if (!row) return c.json({ error: "Not Found" }, 404);

    const tags = await getSnippetTags(id);
    return c.json({ ...row, tags });
  })
  .put("/:id", zValidator("json", snippetSchema), async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "无效的 id" }, 400);
    const body = c.req.valid("json");

    const existing = await db.select().from(snippets).where(eq(snippets.id, id)).get();
    if (!existing) return c.json({ error: "Not Found" }, 404);

    let slug = existing.slug;
    if (body.slug && body.slug.trim() !== existing.slug) {
      slug = await uniqueSlug(body.slug.trim(), id);
    }

    const excerpt = body.excerpt ?? makeExcerpt(body.contentMd);
    const publishedAt =
      body.publishedAt !== undefined
        ? body.publishedAt
        : body.status === "published" && existing.publishedAt == null
          ? new Date().toISOString()
          : existing.publishedAt;

    const [updated] = await db
      .update(snippets)
      .set({
        slug,
        title: body.title,
        contentMd: body.contentMd,
        excerpt,
        language: body.language ?? null,
        coverImage: body.coverImage ?? null,
        status: body.status,
        visibility: body.visibility,
        publishedAt,
      })
      .where(eq(snippets.id, id))
      .returning();

    await replaceSnippetTags(id, body.tagIds);
    const tags = await getSnippetTags(id);

    return c.json({ ...updated, tags });
  })
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "无效的 id" }, 400);

    await db.delete(snippetsToTags).where(eq(snippetsToTags.snippetId, id));
    const deleted = await db.delete(snippets).where(eq(snippets.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: "Not Found" }, 404);
    return c.json({ success: true });
  })
  .put("/:id/status", zValidator("json", snippetStatusSchema), async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "无效的 id" }, 400);
    const { status } = c.req.valid("json");

    const existing = await db.select().from(snippets).where(eq(snippets.id, id)).get();
    if (!existing) return c.json({ error: "Not Found" }, 404);

    const publishedAt =
      status === "published" && existing.publishedAt == null
        ? new Date().toISOString()
        : existing.publishedAt;

    const [updated] = await db
      .update(snippets)
      .set({ status, publishedAt })
      .where(eq(snippets.id, id))
      .returning();

    return c.json(updated);
  });
