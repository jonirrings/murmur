import { createMiddleware } from "hono/factory";
import { count } from "drizzle-orm";
import { auth } from "../lib/auth";
import db from "../db";
import { users } from "../db/schema";
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

/** 单用户模式：已存在任意用户时禁止注册 */
export const requireNoExistingUser = createMiddleware<AppEnv>(async (c, next) => {
  const rows = await db.select({ value: count() }).from(users).all();
  if ((rows[0]?.value ?? 0) > 0) {
    return c.json({ error: "站点已存在管理员，注册已关闭" }, 403);
  }
  await next();
});
