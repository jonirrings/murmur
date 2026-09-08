import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth";
import type { AppEnv } from "../types";

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("session", session);

  await next();
});

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
