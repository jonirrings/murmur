import { Hono } from "hono";

export const adminSnippets = new Hono()
  .get("/", async (c) => {
    return c.json({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  })
  .post("/", async (c) => {
    return c.json({ error: "Not implemented" }, 501);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  })
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  })
  .put("/:id/status", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  });
