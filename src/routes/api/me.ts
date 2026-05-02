import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { requireAuth, requireAdmin } from "@/auth/middleware";
import { UserRepo } from "@/db/repositories/user.repo";
import { CommentRepo } from "@/db/repositories/comment.repo";
import { notes, account, passkey } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

const app = new Hono<Env>();

/** GET /api/me — Current user info including role and approval status */
app.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      approvalStatus: user.approvalStatus,
    },
  });
});

/** GET /api/me/linked-accounts — List current user's linked accounts */
app.get("/linked-accounts", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = c.get("db");
  const accounts = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    })
    .from(account)
    .where(eq(account.userId, user.id))
    .all();
  return c.json({ data: accounts });
});

/** DELETE /api/me/linked-accounts/:providerId — Unlink a provider */
app.delete("/linked-accounts/:providerId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { providerId } = c.req.param();
  const db = c.get("db");

  // Find the linked account
  const linked = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.providerId, providerId)))
    .get();

  if (!linked) {
    return c.json({ error: { code: "NOT_FOUND", message: "未找到关联账号" } }, 404);
  }

  // Check user has at least one other login method
  const otherAccounts = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, user.id), sql`${account.providerId} != ${providerId}`))
    .all();

  const userPasskeys = await db
    .select({ id: passkey.id })
    .from(passkey)
    .where(eq(passkey.userId, user.id))
    .all();

  if (otherAccounts.length === 0 && userPasskeys.length === 0) {
    return c.json(
      { error: { code: "CANNOT_UNLINK", message: "无法解绑：你需要至少保留一种其他登录方式。" } },
      400,
    );
  }

  await db
    .delete(account)
    .where(and(eq(account.id, linked.id), eq(account.userId, user.id)))
    .run();

  return c.json({ data: { success: true } });
});

/** GET /api/admin/stats — Site statistics (admin only) */
app.get("/admin/stats", requireAdmin, async (c) => {
  const db = c.get("db");
  const commentRepo = new CommentRepo(db);
  const userRepo = new UserRepo(db);

  const [publishedNotes, pendingComments, pendingUsers, totalUsers] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(eq(notes.status, "published"))
      .get(),
    commentRepo.countPending(),
    userRepo.count({ approvalStatus: "pending" }),
    userRepo.count(),
  ]);

  return c.json({
    data: {
      publishedNotes: publishedNotes?.count ?? 0,
      pendingComments,
      pendingUsers,
      totalUsers,
    },
  });
});

export default app;
