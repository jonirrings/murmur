import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import type { Env } from "@/auth/middleware";
import { requireAdmin } from "@/auth/middleware";
import { UserRepo } from "@/db/repositories/user.repo";
import { CommentRepo } from "@/db/repositories/comment.repo";
import { account, passkey, twoFactor, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { t } from "@/shared/i18n/server";

const app = new Hono<Env>();

const approvalSchema = z.object({
  approvalStatus: z.enum(["approved", "rejected"]),
});

const roleSchema = z.object({
  role: z.enum(["admin", "author", "commenter"]),
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  role: z.enum(["admin", "author", "commenter"]).optional(),
});

const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  noteId: z.string().optional(),
  authorApproved: z.coerce.number().int().min(0).max(1).optional(),
  adminHidden: z.coerce.number().int().min(0).max(1).optional(),
});

/** GET /api/admin/users — List all users (paginated) */
app.get("/users", requireAdmin, zValidator("query", listUsersQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const repo = new UserRepo(db);
  const filter = {
    approvalStatus: query.approvalStatus,
    role: query.role,
  };
  const [items, total] = await Promise.all([
    repo.findAll(query.page, query.limit, filter),
    repo.count(filter),
  ]);
  return c.json({ data: { items, total, page: query.page, limit: query.limit } });
});

/** GET /api/admin/users/pending — List pending users */
app.get("/users/pending", requireAdmin, async (c) => {
  const db = c.get("db");
  const repo = new UserRepo(db);
  const pendingUsers = await repo.findPending();
  return c.json({ data: pendingUsers });
});

/** PATCH /api/admin/users/:id/approval — Approve or reject a user */
app.patch("/users/:id/approval", requireAdmin, zValidator("json", approvalSchema), async (c) => {
  const { id } = c.req.param();
  const { approvalStatus } = c.req.valid("json");
  const db = c.get("db");
  const repo = new UserRepo(db);

  const target = await repo.findById(id);
  if (!target) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  const updated = await repo.updateApprovalStatus(id, approvalStatus);
  return c.json({ data: updated });
});

/** PATCH /api/admin/users/:id/role — Change user role */
app.patch("/users/:id/role", requireAdmin, zValidator("json", roleSchema), async (c) => {
  const { id } = c.req.param();
  const { role } = c.req.valid("json");
  const db = c.get("db");
  const repo = new UserRepo(db);

  const target = await repo.findById(id);
  if (!target) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  const updated = await repo.updateRole(id, role);
  return c.json({ data: updated });
});

/** GET /api/admin/comments — List all comments (paginated, filterable) */
app.get("/comments", requireAdmin, zValidator("query", listCommentsQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const repo = new CommentRepo(db);
  const result = await repo.findAllPaginated(query.page, query.limit, {
    noteId: query.noteId,
    authorApproved: query.authorApproved,
    adminHidden: query.adminHidden,
  });
  return c.json({ data: { ...result, page: query.page, limit: query.limit } });
});

/** GET /api/admin/users/:id — Get user detail with 2FA status */
app.get("/users/:id", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");

  const targetUser = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      approvalStatus: user.approvalStatus,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, id))
    .get();

  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  const [twoFactorRecord, userPasskeys, userAccounts] = await Promise.all([
    db.select().from(twoFactor).where(eq(twoFactor.userId, id)).get(),
    db
      .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt })
      .from(passkey)
      .where(eq(passkey.userId, id))
      .all(),
    db
      .select({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        createdAt: account.createdAt,
      })
      .from(account)
      .where(eq(account.userId, id))
      .all(),
  ]);

  return c.json({
    data: {
      ...targetUser,
      twoFactorEnabled: !!twoFactorRecord?.verifiedAt,
      passkeys: userPasskeys,
      linkedAccounts: userAccounts,
    },
  });
});

/** DELETE /api/admin/users/:id/totp — Reset user's TOTP */
app.delete("/users/:id/totp", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");

  const targetUser = await db.select().from(user).where(eq(user.id, id)).get();
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  await db.delete(twoFactor).where(eq(twoFactor.userId, id)).run();

  return c.json({ data: { success: true } });
});

/** DELETE /api/admin/users/:id/passkeys/:passkeyId — Delete a specific passkey for a user */
app.delete("/users/:id/passkeys/:passkeyId", requireAdmin, async (c) => {
  const { id, passkeyId } = c.req.param();
  const db = c.get("db");

  const targetPasskey = await db.select().from(passkey).where(eq(passkey.id, passkeyId)).get();

  if (!targetPasskey || targetPasskey.userId !== id) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.passkeyNotFound", c.get("language")) } },
      404,
    );
  }

  await db.delete(passkey).where(eq(passkey.id, passkeyId)).run();

  return c.json({ data: { success: true } });
});

/** DELETE /api/admin/users/:id/passkeys — Delete all passkeys for a user */
app.delete("/users/:id/passkeys", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");

  const targetUser = await db.select().from(user).where(eq(user.id, id)).get();
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  await db.delete(passkey).where(eq(passkey.userId, id)).run();

  return c.json({ data: { success: true } });
});

/** POST /api/admin/users/:id/ban — Ban a user */
app.post("/users/:id/ban", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  const db = c.get("db");

  const targetUser = await db.select().from(user).where(eq(user.id, id)).get();
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  await db
    .update(user)
    .set({ banned: true, banReason: body.reason ?? null, updatedAt: new Date().toISOString() })
    .where(eq(user.id, id))
    .run();

  return c.json({ data: { success: true } });
});

/** POST /api/admin/users/:id/unban — Unban a user */
app.post("/users/:id/unban", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");

  const targetUser = await db.select().from(user).where(eq(user.id, id)).get();
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: t("error.userNotFound", c.get("language")) } },
      404,
    );
  }

  await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date().toISOString() })
    .where(eq(user.id, id))
    .run();

  return c.json({ data: { success: true } });
});

export default app;
