import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { requireAuth, requireAdmin } from "@/auth/middleware";
import { UserRepo } from "@/db/repositories/user.repo";
import { CommentRepo } from "@/db/repositories/comment.repo";
import { notes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const app = new Hono<Env>();

/** GET /api/me — Current user info including role and approval status */
app.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  return c.json({ data: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      approvalStatus: user.approvalStatus,
    },
  });
});

/** GET /api/admin/stats — Site statistics (admin only) */
app.get("/admin/stats", requireAdmin, async (c) => {
  const db = c.get("db");
  const commentRepo = new CommentRepo(db);
  const userRepo = new UserRepo(db);

  const [publishedNotes, pendingComments, pendingUsers, totalUsers] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(eq(notes.status, "published"))
        .get(),
      commentRepo.countPending(),
      userRepo.count({ approvalStatus: "pending" }),
      userRepo.count(),
    ]);

  return c.json({ data: {
      publishedNotes: publishedNotes?.count ?? 0,
      pendingComments,
      pendingUsers,
      totalUsers,
    },
  });
});

export default app;
