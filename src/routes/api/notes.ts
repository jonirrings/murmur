import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createNoteSchema,
  updateNoteSchema,
  publishNoteSchema,
  listNotesQuerySchema,
} from "@/shared/schemas/note";
import type { Env } from "@/auth/middleware";
import { requireAuth, requireAuthor } from "@/auth/middleware";
import {
  NoteService,
  NoteNotFoundError,
  NoteForbiddenError,
  SlugConflictError,
} from "@/services/note.service";

const app = new Hono<Env>();

/** GET /api/notes — List published notes (public) */
app.get("/", zValidator("query", listNotesQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const service = new NoteService(db);
  const result = await service.listPublished(
    query.page,
    query.limit,
    query.category,
    query.tag,
  );
  return c.json({ data: result });
});

/** GET /api/notes/my — List current user's notes */
app.get(
  "/my",
  requireAuthor,
  zValidator("query", listNotesQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const user = c.get("user")!;
    const db = c.get("db");
    const service = new NoteService(db);
    const result = await service.listByAuthor(
      user.id,
      query.page,
      query.limit,
      query.status,
      query.category,
    );
    return c.json({ data: result });
  },
);

/** GET /api/notes/slug/:slug — Get a published note by slug */
app.get("/slug/:slug", async (c) => {
  const { slug } = c.req.param();
  const db = c.get("db");
  const service = new NoteService(db);
  const note = await service.getBySlug(slug);
  return c.json({ data: note });
});

/** GET /api/notes/:id — Get a note by ID */
app.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");
  const service = new NoteService(db);
  const note = await service.getById(id);
  return c.json({ data: note });
});

/** POST /api/notes — Create a note */
app.post(
  "/",
  requireAuthor,
  zValidator("json", createNoteSchema),
  async (c) => {
    const input = c.req.valid("json");
    const user = c.get("user")!;
    const db = c.get("db");
    const service = new NoteService(db);
    const note = await service.create(user.id, input);
    return c.json({ data: note }, 201);
  },
);

/** PATCH /api/notes/:id — Update a note */
app.patch(
  "/:id",
  requireAuthor,
  zValidator("json", updateNoteSchema),
  async (c) => {
    const { id } = c.req.param();
    const input = c.req.valid("json");
    const user = c.get("user")!;
    const db = c.get("db");
    const service = new NoteService(db);
    const note = await service.update(id, user.id, input);
    return c.json({ data: note });
  },
);

/** POST /api/notes/:id/publish — Publish a note */
app.post(
  "/:id/publish",
  requireAuthor,
  zValidator("json", publishNoteSchema),
  async (c) => {
    const { id } = c.req.param();
    const { slug } = c.req.valid("json");
    const user = c.get("user")!;
    const db = c.get("db");
    const service = new NoteService(db);
    const note = await service.publish(id, user.id, slug);
    return c.json({ data: note });
  },
);

/** POST /api/notes/:id/unpublish — Unpublish a note */
app.post("/:id/unpublish", requireAuthor, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = c.get("db");
  const service = new NoteService(db);
  const note = await service.unpublish(id, user.id);
  return c.json({ data: note });
});

/** DELETE /api/notes/:id — Delete a note */
app.delete("/:id", requireAuthor, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = c.get("db");
  const service = new NoteService(db);
  await service.delete(id, user.id);
  return c.json({ data: { ok: true } });
});

// Error mapping
app.onError((err, c) => {
  if (err instanceof NoteNotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  if (err instanceof NoteForbiddenError) {
    return c.json({ error: { code: "FORBIDDEN", message: err.message } }, 403);
  }
  if (err instanceof SlugConflictError) {
    return c.json({ error: { code: "CONFLICT", message: err.message } }, 409);
  }
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "服务内部错误" } },
    500,
  );
});

export default app;
