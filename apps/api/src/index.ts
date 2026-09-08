import { Hono } from "hono";
import { cors } from "hono/cors";
import { methodNotAllowed } from "hono/method-not-allowed";
import { poweredBy } from "hono/powered-by";
import { requestId } from "hono/request-id";
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
import { health } from "./routes/health";
import { feedXml, llmsTxt, robotsTxt, sitemapXml } from "./routes/static";
// import { rateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error";
import { contentSignal } from "./middleware/content-signal";
import { requireSession, sessionMiddleware } from "./middleware/auth";
import type { AppEnv } from "./types";

// 注意：路由注册必须链式，否则 typeof app 只会停留在 BlankSchema，
// hc<AppType> 推导的 client 类型会塌缩为 unknown。
const app = new Hono<AppEnv>()
  // ─── 全局中间件 ───
  .use(requestId())
  .use(poweredBy())
  .use("*", cors())
  .use("*", contentSignal)
  .use("*", errorHandler)
  .use("*", sessionMiddleware)
  // ─── Rate Limiting（按端点差异化） ───
  // .use("/api/auth/*", rateLimiter({ windowMs: 60_000, max: 10 }))
  // .use("/api/admin/*", rateLimiter({ windowMs: 60_000, max: 120 }))
  // .use("/api/public/*", rateLimiter({ windowMs: 60_000, max: 300 }))
  // ─── 静态文件 ───
  .get("/llms.txt", llmsTxt)
  .get("/robots.txt", robotsTxt)
  .get("/sitemap.xml", sitemapXml)
  .get("/feed.xml", feedXml)
  // ─── 健康监测 ───
  .get("/health", health)
  // ─── Auth ───
  .all("/api/auth/*", authRoutes)
  // ─── Public API ───
  .route("/api/public/snippets", publicSnippets)
  .route("/api/public/tags", publicTags)
  .route("/api/public/search", publicSearch)
  // ─── Admin API（需认证） ───
  .use("/api/admin/*", requireSession)
  .route("/api/admin/snippets", adminSnippets)
  .route("/api/admin/tags", adminTags)
  .route("/api/admin/media", adminMedia)
  .route("/api/admin/stats", adminStats)
  .route("/api/admin/export", adminExport)
  .route("/api/admin/import", adminImport);

app.use("*", methodNotAllowed({ app }));

export default app;
