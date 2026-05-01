import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import type { Env } from "@/auth/middleware";
import { requireAdmin } from "@/auth/middleware";
import { UserRepo } from "@/db/repositories/user.repo";
import { CommentRepo } from "@/db/repositories/comment.repo";

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
app.get(
  "/users",
  requireAdmin,
  zValidator("query", listUsersQuerySchema),
  async (c) => {
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
  },
);

/** GET /api/admin/users/pending — List pending users */
app.get("/users/pending", requireAdmin, async (c) => {
  const db = c.get("db");
  const repo = new UserRepo(db);
  const pendingUsers = await repo.findPending();
  return c.json({ data: pendingUsers });
});

/** PATCH /api/admin/users/:id/approval — Approve or reject a user */
app.patch(
  "/users/:id/approval",
  requireAdmin,
  zValidator("json", approvalSchema),
  async (c) => {
    const { id } = c.req.param();
    const { approvalStatus } = c.req.valid("json");
    const db = c.get("db");
    const repo = new UserRepo(db);

    const target = await repo.findById(id);
    if (!target) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "用户不存在" } },
        404,
      );
    }

    const updated = await repo.updateApprovalStatus(id, approvalStatus);
    return c.json({ data: updated });
  },
);

/** PATCH /api/admin/users/:id/role — Change user role */
app.patch(
  "/users/:id/role",
  requireAdmin,
  zValidator("json", roleSchema),
  async (c) => {
    const { id } = c.req.param();
    const { role } = c.req.valid("json");
    const db = c.get("db");
    const repo = new UserRepo(db);

    const target = await repo.findById(id);
    if (!target) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "用户不存在" } },
        404,
      );
    }

    const updated = await repo.updateRole(id, role);
    return c.json({ data: updated });
  },
);

/** GET /api/admin/comments — List all comments (paginated, filterable) */
app.get(
  "/comments",
  requireAdmin,
  zValidator("query", listCommentsQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const repo = new CommentRepo(db);
    const result = await repo.findAllPaginated(query.page, query.limit, {
      noteId: query.noteId,
      authorApproved: query.authorApproved,
      adminHidden: query.adminHidden,
    });
    return c.json({ data: { ...result, page: query.page, limit: query.limit } });
  },
);

export default app;
