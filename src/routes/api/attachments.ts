import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { requireAuthor } from "@/auth/middleware";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { attachments } from "@/db/schema";

const app = new Hono<Env>();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
];

/** POST /api/attachments — Upload a file to R2 */
app.post("/", requireAuthor, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "请上传文件" } },
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "文件大小不能超过 10MB" } },
      400,
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "不支持的文件类型" } },
      400,
    );
  }

  const noteId = body["noteId"];
  if (typeof noteId !== "string" || !noteId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "请指定笔记 ID" } },
      400,
    );
  }

  // Verify note exists and user owns it
  const db = c.get("db");
  const note = await db
    .select({ id: notes.id, authorId: notes.authorId })
    .from(notes)
    .where(eq(notes.id, noteId))
    .get();

  if (!note) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "笔记不存在" } },
      404,
    );
  }

  if (note.authorId !== user.id && user.role !== "admin") {
    return c.json(
      { error: { code: "FORBIDDEN", message: "无权操作此笔记" } },
      403,
    );
  }

  // Upload to R2
  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop() ?? "";
  const r2Key = `attachments/${noteId}/${id}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  // Save metadata to D1
  const attachment = await db
    .insert(attachments)
    .values({
      id,
      noteId,
      r2Key,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  return c.json({ data: attachment }, 201);
});

/** GET /api/attachments/:id — Proxy download from R2 */
app.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");

  const attachment = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .get();

  if (!attachment) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "附件不存在" } },
      404,
    );
  }

  const object = await c.env.R2.get(attachment.r2Key);
  if (!object) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "文件不存在" } },
      404,
    );
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
      "Cache-Control": "public, max-age=31536000",
    },
  });
});

/** DELETE /api/attachments/:id — Delete attachment */
app.delete("/:id", requireAuthor, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = c.get("db");

  const attachment = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .get();

  if (!attachment) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "附件不存在" } },
      404,
    );
  }

  // Check ownership
  const note = await db
    .select({ authorId: notes.authorId })
    .from(notes)
    .where(eq(notes.id, attachment.noteId!))
    .get();

  if (note && note.authorId !== user.id && user.role !== "admin") {
    return c.json(
      { error: { code: "FORBIDDEN", message: "无权删除此附件" } },
      403,
    );
  }

  // Delete from R2 and D1
  await c.env.R2.delete(attachment.r2Key);
  await db.delete(attachments).where(eq(attachments.id, id)).run();

  return c.json({ data: { ok: true } });
});

export default app;
