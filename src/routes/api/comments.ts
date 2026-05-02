import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createCommentSchema,
  listCommentsQuerySchema,
  reviewCommentSchema,
} from "@/shared/schemas/comment";
import type { Env } from "@/auth/middleware";
import { requireAuth, requireApproved, requireAdmin } from "@/auth/middleware";
import {
  CommentService,
  CommentNotFoundError,
  CommentForbiddenError,
  CommentNoteNotPublishedError,
  CommentDuplicateError,
} from "@/services/comment.service";

const app = new Hono<Env>();

/** GET /api/notes/:noteId/comments — List comments for a note */
app.get("/notes/:noteId/comments", zValidator("query", listCommentsQuerySchema), async (c) => {
  const { noteId } = c.req.param();
  const query = c.req.valid("query");
  const db = c.get("db");
  const service = new CommentService(db);

  // Try to get user from session (optional for this endpoint)
  const user = c.get("user");
  const viewer = user
    ? { id: user.id, role: user.role, approvalStatus: user.approvalStatus }
    : null;

  const result = await service.listForNote(noteId, viewer, query.page, query.limit);
  return c.json({ data: result });
});

/** POST /api/notes/:noteId/comments — Create a comment */
app.post(
  "/notes/:noteId/comments",
  requireApproved,
  zValidator("json", createCommentSchema),
  async (c) => {
    const { noteId } = c.req.param();
    const { content } = c.req.valid("json");
    const user = c.get("user")!;
    const db = c.get("db");
    const service = new CommentService(db);

    // Rate limit check via RateLimiterDO (if available)
    if (c.env.RATE_LIMITER_DO) {
      const id = c.env.RATE_LIMITER_DO.idFromName("global");
      const stub = c.env.RATE_LIMITER_DO.get(id);

      // Per-note-per-minute limit: 1 comment/min/user/note
      const perNoteCheck = await checkRateLimit(stub, `comment:${user.id}:${noteId}`, 1, 60_000);
      if (!perNoteCheck.allowed) {
        return c.json(
          { error: { code: "RATE_LIMITED", message: "每篇笔记每分钟只能评论一次" } },
          429,
        );
      }

      // Hourly limit: 20 comments/hour/user
      const hourlyCheck = await checkRateLimit(stub, `comment:${user.id}:hourly`, 20, 3_600_000);
      if (!hourlyCheck.allowed) {
        return c.json(
          { error: { code: "RATE_LIMITED", message: "评论频率过高，请稍后再试" } },
          429,
        );
      }
    } else {
      // Fallback to DB-based rate limiting
      const rateResult = await service.checkRateLimit(user.id, noteId);
      if (!rateResult.allowed) {
        const message =
          rateResult.reason === "PER_NOTE_RATE_LIMITED"
            ? "每篇笔记每分钟只能评论一次"
            : "评论频率过高，请稍后再试";
        return c.json({ error: { code: "RATE_LIMITED", message } }, 429);
      }
    }

    const comment = await service.create(noteId, user.id, content);
    return c.json({ data: comment }, 201);
  },
);

/** PATCH /api/comments/:id/review — Author approves/rejects a comment */
app.patch(
  "/comments/:id/review",
  requireApproved,
  zValidator("json", reviewCommentSchema),
  async (c) => {
    const { id } = c.req.param();
    const input = c.req.valid("json");
    const user = c.get("user")!;
    const db = c.get("db");
    const service = new CommentService(db);

    if (input.authorApproved !== undefined) {
      const comment = await service.reviewByAuthor(id, user.id, input.authorApproved);
      return c.json({ data: comment });
    }

    if (input.adminHidden !== undefined) {
      if (user.role !== "admin") {
        return c.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, 403);
      }
      const comment = await service.reviewByAdmin(id, input.adminHidden);
      return c.json({ data: comment });
    }

    return c.json({ error: { code: "VALIDATION_ERROR", message: "请提供审核操作" } }, 400);
  },
);

/** DELETE /api/comments/:id — Delete a comment */
app.delete("/comments/:id", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = c.get("db");
  const service = new CommentService(db);

  await service.delete(id, user.id, user.role === "admin");
  return c.json({ data: { ok: true } });
});

/** GET /api/admin/comments/pending — List all pending comments (admin) */
app.get("/admin/comments/pending", requireAdmin, async (c) => {
  const db = c.get("db");
  const { comments, user } = await import("@/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  const pendingComments = await db
    .select({
      id: comments.id,
      noteId: comments.noteId,
      authorId: comments.authorId,
      content: comments.content,
      authorApproved: comments.authorApproved,
      adminHidden: comments.adminHidden,
      createdAt: comments.createdAt,
      authorName: user.name,
    })
    .from(comments)
    .innerJoin(user, eq(comments.authorId, user.id))
    .where(eq(comments.authorApproved, 0))
    .orderBy(desc(comments.createdAt))
    .limit(50)
    .all();

  return c.json({ data: pendingComments });
});

// Error mapping
app.onError((err, c) => {
  if (err instanceof CommentNotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  if (err instanceof CommentForbiddenError) {
    return c.json({ error: { code: "FORBIDDEN", message: err.message } }, 403);
  }
  if (err instanceof CommentNoteNotPublishedError) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, 400);
  }
  if (err instanceof CommentDuplicateError) {
    return c.json({ error: { code: "DUPLICATE", message: err.message } }, 409);
  }
  return c.json({ error: { code: "INTERNAL_ERROR", message: "服务内部错误" } }, 500);
});

export default app;

async function checkRateLimit(
  stub: DurableObjectStub,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const res = await stub.fetch(
    new Request("https://do/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, limit, windowMs }),
    }),
  );
  return res.json();
}
