import { Hono } from "hono";

export const adminImport = new Hono()
  .post("/", async (c) => {
    const body = await c.req.json();
    return c.json({ imported: 0, skipped: 0, errors: 0 });
  });
