import { Hono } from "hono";
import { count } from "drizzle-orm";
import db from "../../db";
import { users } from "../../db/schema";

/** 站点信息：是否允许注册（单用户模式下，首个账号注册后即关闭） */
export const publicSite = new Hono().get("/allow-signup", async (c) => {
  const rows = await db.select({ value: count() }).from(users).all();
  return c.json({ allowSignup: (rows[0]?.value ?? 0) === 0 });
});
