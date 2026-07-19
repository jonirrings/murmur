import { Hono } from "hono";
import type { Context } from "hono";

export const authRoutes = new Hono()
  .get("/login", async (c: Context) => {
    return c.json({ message: "auth placeholder" });
  })
  .get("/callback", async (c: Context) => {
    return c.json({ message: "callback placeholder" });
  });
