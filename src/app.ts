import { Hono } from "hono";
import type { Env } from "./auth/middleware";
import { injectDb } from "./auth/middleware";
import { createAuth } from "./auth/better-auth.config";
import { createDb } from "./db/client";
import setupRoutes from "./routes/api/setup";
import adminRoutes from "./routes/api/admin";
import notesRoutes from "./routes/api/notes";
import tagsRoutes from "./routes/api/tags";
import attachmentsRoutes from "./routes/api/attachments";
import commentsRoutes from "./routes/api/comments";
import settingsRoutes from "./routes/api/settings";
import meRoutes from "./routes/api/me";
import ssrRoutes from "./routes/ssr";

const app = new Hono<Env>();

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "服务内部错误" } },
    500,
  );
});

// Inject DB into all routes
app.use("*", injectDb);

// Mount better-auth handler at /api/auth
app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  // Rate limit magic-link login attempts by IP
  if (
    c.req.method === "POST" &&
    c.req.path.endsWith("/magic-link/send") &&
    c.env.RATE_LIMITER_DO
  ) {
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const id = c.env.RATE_LIMITER_DO.idFromName("global");
    const stub = c.env.RATE_LIMITER_DO.get(id);
    const check = await stub.fetch(new Request("https://do/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `login:${ip}`, limit: 10, windowMs: 60_000 }),
    }));
    const result = await check.json<{ allowed: boolean }>();
    if (!result.allowed) {
      return c.json(
        { error: { code: "RATE_LIMITED", message: "登录尝试过于频繁，请稍后再试" } },
        429,
      );
    }
  }

  const db = createDb(c.env.DB);
  const auth = createAuth(db, c.env);
  return auth.handler(c.req.raw);
});

// API routes
app.route("/api/setup", setupRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/notes", notesRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/attachments", attachmentsRoutes);
app.route("/api", commentsRoutes);
app.route("/api/admin/settings", settingsRoutes);
app.route("/api/me", meRoutes);

// SSR routes (public pages)
app.route("/", ssrRoutes);

// SPA fallback: serve index.html for /setup, /login, /admin/*
// In production, these are served from the Vite-built client assets
// In development, the Vite dev server handles this

export default app;
