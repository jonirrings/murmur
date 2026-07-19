import { Hono } from "hono";

export const publicSnippets = new Hono()
  .get("/", async (c) => {
    return c.json({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  })
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    return c.json({ error: `Not Found: ${slug}` }, 404);
  })
  .get("/:slug/raw", async (c) => {
    const slug = c.req.param("slug");
    return c.text(`# Not Found: ${slug}`, 404);
  });
