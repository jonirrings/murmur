import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import db from "../../db";
import { snippets, snippetsToTags, tags } from "../../db/schema";
import { getSnippetTags, querySnippets } from "../../lib/snippets";

const publishedWhere = and(eq(snippets.status, "published"), eq(snippets.visibility, "public"));

export const publicSnippets = new Hono()
  .get("/", async (c) => {
    const page = Number(c.req.query("page") ?? 1);
    const pageSize = Number(c.req.query("pageSize") ?? 10);
    const tagSlug = c.req.query("tag");

    let where = publishedWhere;
    if (tagSlug) {
      const tagRows = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.slug, tagSlug))
        .all();
      if (tagRows.length === 0) {
        return c.json({ items: [], total: 0, page, pageSize, totalPages: 0 });
      }
      const rel = await db
        .select({ snippetId: snippetsToTags.snippetId })
        .from(snippetsToTags)
        .where(eq(snippetsToTags.tagId, tagRows[0].id))
        .all();
      const ids = rel.map((r) => r.snippetId);
      if (ids.length === 0) {
        return c.json({ items: [], total: 0, page, pageSize, totalPages: 0 });
      }
      where = and(where, inArray(snippets.id, ids));
    }

    const result = await querySnippets({ where, page, pageSize });
    return c.json(result);
  })
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const row = await db
      .select()
      .from(snippets)
      .where(and(eq(snippets.slug, slug), publishedWhere))
      .get();
    if (!row) return c.json({ error: "Not Found" }, 404);

    const tags = await getSnippetTags(row.id);
    return c.json({ ...row, tags });
  })
  .get("/:slug/raw", async (c) => {
    const slug = c.req.param("slug");
    const row = await db
      .select({ contentMd: snippets.contentMd })
      .from(snippets)
      .where(and(eq(snippets.slug, slug), publishedWhere))
      .get();
    if (!row) return c.text("Not Found", 404);
    return c.text(row.contentMd, 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });
