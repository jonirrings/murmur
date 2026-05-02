import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { NoteService } from "@/services/note.service";
import { SitemapCache } from "@/services/cache.service";
import { NOTE_CATEGORIES } from "@/shared/constants";

const app = new Hono<Env>();

/** GET /sitemap.xml — Generate sitemap from published notes */
app.get("/sitemap.xml", async (c) => {
  const kv = c.env.KV;

  // Try KV cache first
  if (kv) {
    const cache = new SitemapCache(kv);
    const cached = await cache.get();
    if (cached) {
      return c.text(cached, 200, { "Content-Type": "application/xml" });
    }
  }

  const db = createDb(c.env.DB);
  const service = new NoteService(db);
  const origin = c.env.ORIGIN || "https://murmur.example.com";

  // Get all published notes (up to 1000)
  const { items } = await service.listPublished(1, 1000);

  const urls = items
    .map((note) => {
      const loc = note.slug ? `${origin}/note/${note.slug}` : `${origin}/note/${note.id}`;
      const lastmod = note.updatedAt ? `<lastmod>${note.updatedAt}</lastmod>` : "";
      return `  <url>
    <loc>${loc}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join("\n");

  const categoryUrls = NOTE_CATEGORIES.map(
    (cat) => `  <url>
    <loc>${origin}/category/${cat}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`,
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${categoryUrls}
${urls}
</urlset>`;

  // Cache in KV
  if (kv) {
    const cache = new SitemapCache(kv);
    await cache.set(xml);
  }

  return c.text(xml, 200, { "Content-Type": "application/xml" });
});

/** GET /robots.txt — Allow all crawlers */
app.get("/robots.txt", async (c) => {
  const origin = c.env.ORIGIN || "https://murmur.example.com";
  const txt = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return c.text(txt);
});

export default app;
