import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicSnippets } from "./routes/public/snippets";
import { publicTags } from "./routes/public/tags";
import { publicSearch } from "./routes/public/search";
import { adminSnippets } from "./routes/admin/snippets";
import { adminTags } from "./routes/admin/tags";
import { adminMedia } from "./routes/admin/media";
import { adminStats } from "./routes/admin/stats";
import { adminExport } from "./routes/admin/export";
import { adminImport } from "./routes/admin/import";
import { authRoutes } from "./routes/auth";
import { llmsTxt, robotsTxt, sitemapXml, feedXml } from "./routes/static";
import { rateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error";
import { contentSignal } from "./middleware/content-signal";

const app = new Hono();

// ─── 全局中间件 ───
app.use("*", cors());
app.use("*", contentSignal);
app.use("*", errorHandler);

// ─── Rate Limiting（按端点差异化） ───
app.use("/auth/*", rateLimiter({ windowMs: 60_000, max: 10 }));
app.use("/api/admin/*", rateLimiter({ windowMs: 60_000, max: 120 }));
app.use("/api/public/*", rateLimiter({ windowMs: 60_000, max: 300 }));

// ─── 静态文件 ───
app.get("/llms.txt", llmsTxt);
app.get("/robots.txt", robotsTxt);
app.get("/sitemap.xml", sitemapXml);
app.get("/feed.xml", feedXml);

// ─── Auth ───
app.route("/auth", authRoutes);

// ─── Public API ───
app.route("/api/public/snippets", publicSnippets);
app.route("/api/public/tags", publicTags);
app.route("/api/public/search", publicSearch);

// ─── Admin API（需认证） ───
app.route("/api/admin/snippets", adminSnippets);
app.route("/api/admin/tags", adminTags);
app.route("/api/admin/media", adminMedia);
app.route("/api/admin/stats", adminStats);
app.route("/api/admin/export", adminExport);
app.route("/api/admin/import", adminImport);

// 注意：无需代理 /admin/* 和 /* 到 Pages。
// Cloudflare Worker Routes 优先匹配 /api/* 和 /auth/*，
// 未匹配的请求自动 fall through 到 Pages。

export default app;