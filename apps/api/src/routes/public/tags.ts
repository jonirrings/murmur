import { Hono } from "hono";

export const publicTags = new Hono().get("/", async (c) => {
  return c.json({ items: [] });
});
