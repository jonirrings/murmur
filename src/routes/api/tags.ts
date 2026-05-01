import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTagSchema } from "@/shared/schemas/tag";
import type { Env } from "@/auth/middleware";
import { requireAdmin } from "@/auth/middleware";
import { TagService, TagSlugConflictError, TagNotFoundError, TagInUseError } from "@/services/tag.service";

const app = new Hono<Env>();

/** GET /api/tags — List all tags (public) */
app.get("/", async (c) => {
  const db = c.get("db");
  const service = new TagService(db);
  const tags = await service.list();
  return c.json({ data: tags });
});

/** POST /api/tags — Create a tag (admin only) */
app.post("/", requireAdmin, zValidator("json", createTagSchema), async (c) => {
  const input = c.req.valid("json");
  const db = c.get("db");
  const service = new TagService(db);
  const tag = await service.create(input);
  return c.json({ data: tag }, 201);
});

/** DELETE /api/tags/:id — Delete a tag (admin only) */
app.delete("/:id", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");
  const service = new TagService(db);
  await service.delete(id);
  return c.json({ data: { ok: true } });
});

app.onError((err, c) => {
  if (err instanceof TagSlugConflictError) {
    return c.json({ error: { code: "CONFLICT", message: err.message } }, 409);
  }
  if (err instanceof TagNotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  if (err instanceof TagInUseError) {
    return c.json({ error: { code: "CONFLICT", message: err.message } }, 409);
  }
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "服务内部错误" } },
    500,
  );
});

export default app;
