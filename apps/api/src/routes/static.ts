import type { Context } from "hono";

export async function llmsTxt(c: Context): Promise<Response> {
  return c.text(
    "# murmur / m.o0x0o.com\n" +
      "> Blog Title: Murmur — 碎碎念\n" +
      "> Description: Short technical notes and TILs\n",
    200,
    { "Content-Type": "text/plain; charset=utf-8" },
  );
}

export async function robotsTxt(c: Context): Promise<Response> {
  return c.text("User-agent: *\nAllow: /\n\n" + "Sitemap: https://m.o0x0o.com/sitemap.xml", 200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
}

export async function sitemapXml(c: Context): Promise<Response> {
  return c.text(
    '<?xml version="1.0"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>',
    200,
    { "Content-Type": "application/xml; charset=utf-8" },
  );
}

export async function feedXml(c: Context): Promise<Response> {
  const now = new Date().toISOString();
  return c.text(
    `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<feed xmlns="http://www.w3.org/2005/Atom">\n` +
      `  <title>Murmur — 碎碎念</title>\n` +
      `  <link href="https://m.o0x0o.com/feed.xml" rel="self"/>\n` +
      `  <link href="https://m.o0x0o.com/"/>\n` +
      `  <updated>${now}</updated>\n` +
      `  <author><name>Jonirrings</name></author>\n` +
      `  <id>https://m.o0x0o.com/</id>\n` +
      `</feed>`,
    200,
    { "Content-Type": "application/atom+xml; charset=utf-8" },
  );
}
