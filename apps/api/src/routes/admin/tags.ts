import { Hono } from "hono";

export const adminTags = new Hono()
  .get("/", async (c) => {
    return c.json({ items: [] });
  })
  .post("/", async (c) => {
    return c.json({ error: "Not implemented" }, 501);
  })
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  });
