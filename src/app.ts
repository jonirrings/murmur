import { Hono } from "hono";
import { languageDetector } from "hono/language";
import type { Env } from "./auth/middleware";
import { injectDb } from "./auth/middleware";
import { createAuth } from "./auth/better-auth.config";
import { createDb } from "./db/client";
import { t } from "./shared/i18n/server";
import setupRoutes from "./routes/api/setup";
import adminRoutes from "./routes/api/admin";
import notesRoutes from "./routes/api/notes";
import tagsRoutes from "./routes/api/tags";
import attachmentsRoutes from "./routes/api/attachments";
import commentsRoutes from "./routes/api/comments";
import settingsRoutes from "./routes/api/settings";
import meRoutes from "./routes/api/me";
import searchRoutes from "./routes/api/search";
import collabRoutes from "./routes/api/collab";
import visitorCounterRoutes from "./routes/api/visitor-counter";
import viewStatsRoutes from "./routes/api/view-stats";
import ssrRoutes from "./routes/ssr";
import seoRoutes from "./routes/seo";

const app = new Hono<Env>();

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: t("error.internalError", c.get("language")) } },
    500,
  );
});

// Inject DB into all routes
app.use("*", injectDb);

// Language detection for all routes
app.use(
  "*",
  languageDetector({
    supportedLanguages: ["zh-CN", "en", "ja"],
    fallbackLanguage: "en",
    order: ["header"],
    caches: [],
  }),
);

// Mount better-auth handler at /api/auth
// Note: Hono v4 requires app.use() for wildcard sub-path matching, not app.on() or app.all()
app.use("/api/auth/*", async (c) => {
  // Rate limit magic-link login attempts by IP
  if (c.req.method === "POST" && c.req.path.endsWith("/magic-link/send") && c.env.RATE_LIMITER_DO) {
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const id = c.env.RATE_LIMITER_DO.idFromName("global");
    const stub = c.env.RATE_LIMITER_DO.get(id);
    const check = await stub.fetch(
      new Request("https://do/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: `login:${ip}`, limit: 10, windowMs: 60_000 }),
      }),
    );
    const result = await check.json<{ allowed: boolean }>();
    if (!result.allowed) {
      return c.json(
        {
          error: { code: "RATE_LIMITED", message: t("error.loginRateLimited", c.get("language")) },
        },
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
app.route("/api/search", searchRoutes);
app.route("/api/collab", collabRoutes);
app.route("/api/visitor-counter", visitorCounterRoutes);
app.route("/api/admin/view-stats", viewStatsRoutes);

// SSR routes (public pages)
app.route("/", ssrRoutes);

// SEO routes
app.route("/", seoRoutes);

// SPA fallback: let Workers Assets serve index.html for client-side routes
app.get("/setup", serveSpaAssets);
app.get("/login", serveSpaAssets);
app.get("/admin/*", serveSpaAssets);

// Serve static assets via Workers Assets binding
app.get("/assets/*", serveStaticAssets);

async function serveSpaAssets(c: import("hono").Context<import("./auth/middleware").Env>) {
  const assets = c.env.ASSETS;
  if (assets) {
    const response = await assets.fetch(new Request(new URL("/index.html", c.req.url)));
    if (response.status === 200) return response;
  }
  return c.notFound();
}

async function serveStaticAssets(c: import("hono").Context<import("./auth/middleware").Env>) {
  const assets = c.env.ASSETS;
  if (assets) {
    const response = await assets.fetch(c.req.raw);
    if (response.status === 200) return response;
  }
  return c.notFound();
}

export default app;
