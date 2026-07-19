import { Hono } from "hono";

export const publicSearch = new Hono()
  .get("/", async (c) => {
    const q = c.req.query("q") || "";
    return c.json({ items: [], total: 0, query: q });
  });
