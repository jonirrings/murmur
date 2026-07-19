import { Hono } from "hono";

export const adminMedia = new Hono()
  .get("/", async (c) => {
    return c.json({ items: [] });
  })
  .post("/upload", async (c) => {
    return c.json({ error: "Not implemented" }, 501);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    return c.json({ error: `Not Found: ${id}` }, 404);
  });
