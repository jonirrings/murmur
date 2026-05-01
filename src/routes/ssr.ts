import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { NoteService } from "@/services/note.service";
import { renderMarkdown } from "@/services/render.service";

const app = new Hono<Env>();

/** GET / — Home page: list published notes */
app.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const service = new NoteService(db);
  const page = Number(c.req.query("page") || "1");
  const { items, total } = await service.listPublished(page, 20);

  const noteListHtml = items
    .map(
      (note) => `
    <article class="note-card">
      <h2><a href="/note/${note.slug ?? note.id}">${escapeHtml(note.title)}</a></h2>
      <p class="excerpt">${escapeHtml(note.excerpt)}</p>
      <time datetime="${note.publishedAt ?? ""}">${formatDate(note.publishedAt ?? note.createdAt)}</time>
    </article>`,
    )
    .join("");

  const html = renderPage("Murmur", `
    <div class="container">
      <h1>Murmur</h1>
      <div class="notes-list">${noteListHtml || "<p>暂无笔记</p>"}</div>
      ${total > 20 ? `<nav class="pagination"><a href="/?page=${page + 1}">下一页</a></nav>` : ""}
    </div>
  `);

  return c.html(html);
});

/** GET /note/:slug — Note detail page */
app.get("/note/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = createDb(c.env.DB);
  const service = new NoteService(db);

  try {
    const note = await service.getBySlug(slug);
    const contentHtml = await renderMarkdown(note.content ?? "");
    const tagsHtml = (note.tags ?? [])
      .map((t) => `<a href="/tag/${t.slug}" class="tag">${escapeHtml(t.name)}</a>`)
      .join("");

    const html = renderPage(note.title, `
      <article class="note-detail">
        <header>
          <h1>${escapeHtml(note.title)}</h1>
          <div class="meta">
            <span class="author">${escapeHtml(note.author?.name ?? "匿名")}</span>
            <time datetime="${note.publishedAt ?? ""}">${formatDate(note.publishedAt ?? note.createdAt)}</time>
          </div>
          <div class="tags">${tagsHtml}</div>
        </header>
        <div class="content prose">${contentHtml}</div>
        <div id="comments-section" data-note-id="${note.id}" data-note-author-id="${note.authorId ?? ""}"></div>
      </article>
    `, note.excerpt);

    return c.html(html);
  } catch {
    return c.html(renderPage("404", "<h1>笔记不存在</h1>"), 404);
  }
});

/** GET /tag/:tag — Notes by tag */
app.get("/tag/:tag", async (c) => {
  const tagSlug = c.req.param("tag");
  const db = createDb(c.env.DB);
  const service = new NoteService(db);
  const page = Number(c.req.query("page") || "1");
  const { items, total } = await service.listPublished(page, 20, undefined, tagSlug);

  const noteListHtml = items
    .map(
      (note) => `
    <article class="note-card">
      <h2><a href="/note/${note.slug ?? note.id}">${escapeHtml(note.title)}</a></h2>
      <p class="excerpt">${escapeHtml(note.excerpt)}</p>
      <time datetime="${note.publishedAt ?? ""}">${formatDate(note.publishedAt ?? note.createdAt)}</time>
    </article>`,
    )
    .join("");

  const html = renderPage(`标签: ${tagSlug}`, `
    <div class="container">
      <h1>标签: ${escapeHtml(tagSlug)}</h1>
      <div class="notes-list">${noteListHtml || "<p>暂无笔记</p>"}</div>
      ${total > 20 ? `<nav class="pagination"><a href="/tag/${tagSlug}?page=${page + 1}">下一页</a></nav>` : ""}
    </div>
  `);

  return c.html(html);
});

function renderPage(title: string, body: string, description?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Murmur</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <meta property="og:title" content="${escapeHtml(title)}">
  ${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ""}
  <meta property="og:type" content="article">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 48rem; margin: 0 auto; padding: 1.5rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .note-card { padding: 1rem 0; border-bottom: 1px solid #e5e7eb; }
    .excerpt { color: #6b7280; margin: 0.25rem 0; }
    time { color: #9ca3af; font-size: 0.875rem; }
    .tag { display: inline-block; padding: 0.125rem 0.5rem; margin: 0.125rem; background: #f3f4f6; border-radius: 0.25rem; font-size: 0.75rem; color: #4b5563; }
    .prose { max-width: none; }
    .prose pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    .prose code { font-family: "Fira Code", monospace; font-size: 0.875rem; }
    .prose img { max-width: 100%; border-radius: 0.5rem; }
    .prose blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; }
    .pagination { margin-top: 1.5rem; text-align: center; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default app;
