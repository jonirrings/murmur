import { Hono } from "hono";
import type { Env } from "@/auth/middleware";
import { requireAuth, requireApproved } from "@/auth/middleware";
import { collabSessions } from "@/db/schema";
import { CollabSessionRepo } from "@/db/repositories/collab-session.repo";
import { eq, and } from "drizzle-orm";

const app = new Hono<Env>();

/** POST /api/collab/rooms/:noteId — Join a collaboration room */
app.post("/rooms/:noteId", requireApproved, async (c) => {
  const { noteId } = c.req.param();
  const user = c.get("user")!;
  const db = c.get("db");

  // Create or find active session
  const existing = await db
    .select()
    .from(collabSessions)
    .where(and(eq(collabSessions.noteId, noteId), eq(collabSessions.isActive, 1)))
    .get();

  if (!existing) {
    const sessionRepo = new CollabSessionRepo(db);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await sessionRepo.create({
      id: crypto.randomUUID(),
      noteId,
      creatorId: user.id,
      role: "editor",
      token: crypto.randomUUID(),
      isActive: 1,
      createdAt: now,
      expiresAt,
    });
  }

  const role = "editor";

  const doId = c.env.COLLAB_DO.idFromName(`note:${noteId}`);
  const stub = c.env.COLLAB_DO.get(doId);

  const joinRes = await stub.fetch(
    new Request(`https://do/join?noteId=${noteId}`, { method: "GET" }),
  );

  if (!joinRes.ok) {
    return c.json({ error: { code: "COLLAB_ERROR", message: "Failed to join room" } }, 500);
  }

  return c.json({
    data: {
      noteId,
      role,
      wsUrl: `/api/collab/ws?noteId=${noteId}&role=${role}`,
    },
  });
});

/** GET /api/collab/rooms/:noteId/info — Get room info */
app.get("/rooms/:noteId/info", requireAuth, async (c) => {
  const { noteId } = c.req.param();

  const doId = c.env.COLLAB_DO.idFromName(`note:${noteId}`);
  const stub = c.env.COLLAB_DO.get(doId);

  const infoRes = await stub.fetch(new Request(`https://do/info?noteId=${noteId}`));
  const info = await infoRes.json();

  return c.json({ data: info });
});

/** GET /api/collab/rooms/:noteId/sessions — List active sessions for a note */
app.get("/rooms/:noteId/sessions", requireAuth, async (c) => {
  const { noteId } = c.req.param();
  const db = c.get("db");

  const sessionRepo = new CollabSessionRepo(db);
  const sessions = await sessionRepo.findActiveByNoteId(noteId);

  return c.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      noteId: s.noteId,
      creatorId: s.creatorId,
      role: s.role,
      isActive: s.isActive,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
  });
});

/** DELETE /api/collab/rooms/:noteId/sessions/:sessionId — Deactivate a session */
app.delete("/rooms/:noteId/sessions/:sessionId", requireAuth, async (c) => {
  const { sessionId } = c.req.param();
  const db = c.get("db");

  const sessionRepo = new CollabSessionRepo(db);
  const session = await sessionRepo.findById(sessionId);

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  await sessionRepo.deactivate(sessionId);

  return c.json({ data: { ok: true } });
});

/** DELETE /api/collab/rooms/:noteId — Leave a collaboration room */
app.delete("/rooms/:noteId", requireAuth, async (c) => {
  const { noteId } = c.req.param();

  const doId = c.env.COLLAB_DO.idFromName(`note:${noteId}`);
  const stub = c.env.COLLAB_DO.get(doId);

  await stub.fetch(new Request(`https://do/leave?noteId=${noteId}`));

  return c.json({ data: { ok: true } });
});

/** POST /api/collab/cleanup — Deactivate expired sessions (admin) */
app.post("/cleanup", requireAuth, async (c) => {
  const user = c.get("user")!;
  if (user.role !== "admin") {
    return c.json({ error: { code: "FORBIDDEN", message: "Admin only" } }, 403);
  }

  const db = c.get("db");
  const sessionRepo = new CollabSessionRepo(db);
  const count = await sessionRepo.deactivateExpired();

  // Also clean up old inactive sessions
  await sessionRepo.deleteOldInactive();

  return c.json({ data: { deactivated: count } });
});

/** GET /api/collab/ws — WebSocket upgrade for Yjs sync (authenticated) */
app.get("/ws", requireAuth, async (c) => {
  const noteId = c.req.query("noteId");
  if (!noteId) {
    return c.json({ error: { code: "MISSING_NOTE_ID" } }, 400);
  }

  const role = c.req.query("role") === "viewer" ? "viewer" : "editor";

  const doId = c.env.COLLAB_DO.idFromName(`note:${noteId}`);
  const stub = c.env.COLLAB_DO.get(doId);

  // Forward the WebSocket upgrade to the DO with role parameter
  const url = new URL(c.req.url);
  url.searchParams.set("role", role);
  const newRequest = new Request(url.toString(), c.req.raw);
  return stub.fetch(newRequest);
});

/** GET /api/collab/ws/view — WebSocket upgrade for read-only preview (no auth) */
app.get("/ws/view", async (c) => {
  const noteId = c.req.query("noteId");
  if (!noteId) {
    return c.json({ error: { code: "MISSING_NOTE_ID" } }, 400);
  }

  const doId = c.env.COLLAB_DO.idFromName(`note:${noteId}`);
  const stub = c.env.COLLAB_DO.get(doId);

  // Force viewer role
  const url = new URL(c.req.url);
  url.pathname = "/ws";
  url.searchParams.set("role", "viewer");
  const newRequest = new Request(url.toString(), c.req.raw);
  return stub.fetch(newRequest);
});

/** POST /api/collab/preview/:noteId — Create a preview token */
app.post("/preview/:noteId", requireApproved, async (c) => {
  const { noteId } = c.req.param();
  const user = c.get("user")!;
  const db = c.get("db");
  const kv = c.env.KV;

  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const sessionRepo = new CollabSessionRepo(db);
  await sessionRepo.create({
    id: crypto.randomUUID(),
    noteId,
    creatorId: user.id,
    role: "viewer",
    token,
    isActive: 1,
    createdAt: now,
    expiresAt,
  });

  if (kv) {
    await kv.put(`preview:${token}`, noteId, { expirationTtl: 3600 });
  }

  return c.json({
    data: {
      token,
      previewUrl: `/preview/${token}`,
      wsUrl: `/api/collab/ws/view?noteId=${noteId}`,
      expiresAt,
    },
  });
});

export default app;
