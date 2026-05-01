import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { createAuth, type AuthEnv } from "./better-auth.config";
import type { Database } from "@/db/client";
import { createDb } from "@/db/client";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ROLE_HIERARCHY } from "@/shared/constants";

type Env = {
  Bindings: AuthEnv;
  Variables: {
    db: Database;
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: "admin" | "author" | "commenter";
      approvalStatus: "pending" | "approved" | "rejected";
    } | null;
  };
};

export type { Env };

/** Inject db and auth instances into context */
export const injectDb = createMiddleware<Env>(async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

/** Require authenticated user */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const session = await getSession(c);
  if (!session) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
  }
  c.set("user", session);
  await next();
});

/** Require admin role */
export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const session = await getSession(c);
  if (!session) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
  }
  if (session.role !== "admin") {
    return c.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, 403);
  }
  c.set("user", session);
  await next();
});

/** Require author role or above */
export const requireAuthor = createMiddleware<Env>(async (c, next) => {
  const session = await getSession(c);
  if (!session) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
  }
  if (!hasRole(session.role, "author")) {
    return c.json({ error: { code: "FORBIDDEN", message: "需要作者权限" } }, 403);
  }
  c.set("user", session);
  await next();
});

/** Require approved user (approvalStatus === 'approved') */
export const requireApproved = createMiddleware<Env>(async (c, next) => {
  const session = await getSession(c);
  if (!session) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
  }
  if (session.approvalStatus !== "approved") {
    return c.json(
      { error: { code: "FORBIDDEN", message: "账号尚未通过审批" } },
      403,
    );
  }
  c.set("user", session);
  await next();
});

/** Check if role meets or exceeds the required level */
function hasRole(
  userRole: string,
  requiredRole: "admin" | "author" | "commenter",
): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/** Extract session from better-auth cookie/header and fetch user from DB */
async function getSession(
  c: Context<Env>,
): Promise<Env["Variables"]["user"] | null> {
  try {
    const db = c.get("db");
    const auth = createAuth(db, c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) return null;

    const dbUser = await db
      .select({
        role: user.role,
        approvalStatus: user.approvalStatus,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get();

    if (!dbUser) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      role: dbUser.role,
      approvalStatus: dbUser.approvalStatus,
    };
  } catch {
    return null;
  }
}
