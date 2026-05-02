/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { NoteService } from "@/services/note.service";
import { CommentRepo } from "@/db/repositories/comment.repo";
import { SsrCache } from "@/services/cache.service";
import { ViewTrackerService } from "@/services/view-tracker.service";
import { renderMarkdown } from "@/services/render.service";
import { collabSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { detectLocale, t } from "@/shared/i18n/server";
import { NOTE_CATEGORIES } from "@/shared/constants";
import type { NoteCategory } from "@/shared/types";
import {
  NoteListPage,
  TagPage,
  CategoryPage,
  NoteDetailPage,
  PreviewPage,
  ErrorPage,
} from "@/components/ssr/note-detail";

const app = new Hono<Env>();

/** GET / — Home page: list published notes */
app.get("/", async (c) => {
  const kv = c.env.KV;
  const locale = detectLocale(c.req.header("Accept-Language"));
  const cacheKey = `/${locale}`;

  if (kv) {
    const cache = new SsrCache(kv);
    const cached = await cache.get(cacheKey);
    if (cached) return c.html(cached);
  }

  const db = createDb(c.env.DB);
  const service = new NoteService(db);
  const page = Number(c.req.query("page") || "1");
  const { items, total } = await service.listPublished(page, 20);

  const html = (
    <NoteListPage
      notes={items.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.excerpt ?? "",
        slug: n.slug,
        publishedAt: n.publishedAt,
        createdAt: n.createdAt,
      }))}
      total={total}
      page={page}
      acceptLanguage={c.req.header("Accept-Language")}
      pageKey="/"
    />
  );

  if (kv) {
    const cache = new SsrCache(kv);
    // eslint-disable-next-line typescript-eslint/no-base-to-string -- Hono JSX elements implement toString()
    await cache.set(cacheKey, String(html));
  }

  return c.html(html);
});

/** GET /note/:slug — Note detail page */
app.get("/note/:slug", async (c) => {
  const slug = c.req.param("slug");
  const kv = c.env.KV;
  const locale = detectLocale(c.req.header("Accept-Language"));
  const cacheKey = `/note/${slug}/${locale}`;

  if (kv) {
    const cache = new SsrCache(kv);
    const cached = await cache.get(cacheKey);
    if (cached) return c.html(cached);
  }

  const db = createDb(c.env.DB);
  const service = new NoteService(db);

  try {
    const note = await service.getBySlug(slug);

    // Increment view count (non-blocking, bot-filtered)
    const viewTracker = new ViewTrackerService(db);
    c.executionCtx.waitUntil?.(viewTracker.incrementViewCount(note.id, c.req.raw));

    const [contentHtml, comments] = await Promise.all([
      renderMarkdown(note.content ?? ""),
      new CommentRepo(db).findVisibleByNoteId(note.id, 1, 50),
    ]);

    const html = (
      <NoteDetailPage
        note={{
          id: note.id,
          title: note.title,
          content: note.content ?? "",
          excerpt: note.excerpt ?? "",
          slug: note.slug,
          authorId: note.authorId,
          publishedAt: note.publishedAt,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          viewCount: note.viewCount ?? 0,
          author: note.author ? { name: note.author.name } : null,
          tags: note.tags,
        }}
        contentHtml={contentHtml}
        comments={comments.map((cm) => ({
          id: cm.id,
          authorName: cm.authorName,
          content: cm.content,
          createdAt: cm.createdAt,
        }))}
        acceptLanguage={c.req.header("Accept-Language")}
        pageKey={`/note/${slug}`}
      />
    );

    if (kv) {
      const cache = new SsrCache(kv);
      // eslint-disable-next-line typescript-eslint/no-base-to-string -- Hono JSX elements implement toString()
      await cache.set(cacheKey, String(html), 600);
    }

    return c.html(html);
  } catch {
    const html = (
      <ErrorPage
        title="404"
        message={t("noteNotFound", locale)}
        acceptLanguage={c.req.header("Accept-Language")}
      />
    );
    return c.html(html, 404);
  }
});

/** GET /tag/:tag — Notes by tag */
app.get("/tag/:tag", async (c) => {
  const tagSlug = c.req.param("tag");
  const kv = c.env.KV;
  const locale = detectLocale(c.req.header("Accept-Language"));
  const cacheKey = `/tag/${tagSlug}/${locale}`;

  if (kv) {
    const cache = new SsrCache(kv);
    const cached = await cache.get(cacheKey);
    if (cached) return c.html(cached);
  }

  const db = createDb(c.env.DB);
  const service = new NoteService(db);
  const page = Number(c.req.query("page") || "1");
  const { items, total } = await service.listPublished(page, 20, undefined, tagSlug);

  const html = (
    <TagPage
      tagSlug={tagSlug}
      notes={items.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.excerpt ?? "",
        slug: n.slug,
        publishedAt: n.publishedAt,
        createdAt: n.createdAt,
      }))}
      total={total}
      page={page}
      acceptLanguage={c.req.header("Accept-Language")}
      pageKey={`/tag/${tagSlug}`}
    />
  );

  if (kv) {
    const cache = new SsrCache(kv);
    // eslint-disable-next-line typescript-eslint/no-base-to-string -- Hono JSX elements implement toString()
    await cache.set(cacheKey, String(html));
  }

  return c.html(html);
});

/** GET /category/:category — Notes by category */
app.get("/category/:category", async (c) => {
  const categorySlug = c.req.param("category");
  const kv = c.env.KV;
  const locale = detectLocale(c.req.header("Accept-Language"));

  if (!NOTE_CATEGORIES.includes(categorySlug as (typeof NOTE_CATEGORIES)[number])) {
    const html = (
      <ErrorPage
        title="404"
        message={t("categoryNotFound", locale)}
        acceptLanguage={c.req.header("Accept-Language")}
      />
    );
    return c.html(html, 404);
  }

  const cacheKey = `/category/${categorySlug}/${locale}`;

  if (kv) {
    const cache = new SsrCache(kv);
    const cached = await cache.get(cacheKey);
    if (cached) return c.html(cached);
  }

  const db = createDb(c.env.DB);
  const service = new NoteService(db);
  const page = Number(c.req.query("page") || "1");
  const { items, total } = await service.listPublished(page, 20, categorySlug as NoteCategory);

  const html = (
    <CategoryPage
      categorySlug={categorySlug}
      notes={items.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.excerpt ?? "",
        slug: n.slug,
        publishedAt: n.publishedAt,
        createdAt: n.createdAt,
      }))}
      total={total}
      page={page}
      acceptLanguage={c.req.header("Accept-Language")}
      pageKey={`/category/${categorySlug}`}
    />
  );

  if (kv) {
    const cache = new SsrCache(kv);
    // eslint-disable-next-line typescript-eslint/no-base-to-string -- Hono JSX elements implement toString()
    await cache.set(cacheKey, String(html));
  }

  return c.html(html);
});

/** GET /preview/:token — Read-only preview page */
app.get("/preview/:token", async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV;
  const locale = detectLocale(c.req.header("Accept-Language"));

  let noteId: string | null = null;
  if (kv) {
    noteId = await kv.get(`preview:${token}`);
  }

  if (!noteId) {
    const db = createDb(c.env.DB);
    const session = await db
      .select()
      .from(collabSessions)
      .where(eq(collabSessions.token, token))
      .get();

    if (!session || !session.isActive || new Date(session.expiresAt) < new Date()) {
      const html = (
        <ErrorPage
          title={t("previewExpired", locale)}
          message={t("previewLinkExpired", locale)}
          description={t("previewLinkExpiredDesc", locale)}
          acceptLanguage={c.req.header("Accept-Language")}
        />
      );
      return c.html(html, 410);
    }
    noteId = session.noteId;
  }

  if (!noteId) {
    const html = (
      <ErrorPage
        title={t("previewExpired", locale)}
        message={t("previewLinkInvalid", locale)}
        acceptLanguage={c.req.header("Accept-Language")}
      />
    );
    return c.html(html, 404);
  }

  const db = createDb(c.env.DB);
  const service = new NoteService(db);

  try {
    const note = await service.getById(noteId);
    const contentHtml = await renderMarkdown(note.content ?? "");

    const html = (
      <PreviewPage
        note={{
          id: note.id,
          title: note.title,
          content: note.content ?? "",
          excerpt: note.excerpt ?? "",
          updatedAt: note.updatedAt,
          author: note.author ? { name: note.author.name } : null,
          tags: note.tags,
        }}
        contentHtml={contentHtml}
        acceptLanguage={c.req.header("Accept-Language")}
        pageKey={`/preview/${token}`}
      />
    );

    return c.html(html);
  } catch {
    const html = (
      <ErrorPage
        title="404"
        message={t("noteNotFound", locale)}
        acceptLanguage={c.req.header("Accept-Language")}
      />
    );
    return c.html(html, 404);
  }
});

export default app;
