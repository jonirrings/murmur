# Murmur 分步骤实施计划

> 基于 `PLAN.md` 概要设计，本文档为逐步骤可执行的实施计划。

## 前置条件

- [x] Node.js ≥ 22
- [x] pnpm ≥ 9（`corepack enable && corepack prepare pnpm@latest --activate`）
- [x] Cloudflare 账号 + Wrangler CLI 已登录（`wrangler login`）
- [x] `m.o0x0o.com` 域名已在 Cloudflare DNS 中管理
- [x] GitHub 仓库 `murmur` 已创建

---

## 架构总览

```
m.o0x0o.com 流量 → Cloudflare Edge 按 URL 最长前缀匹配分发（全部为 Cloudflare Workers）:

m.o0x0o.com 上的 Worker Routes:

    /api/*       → murmur-api (Hono，唯一绑定 D1/R2)
    /auth/*      → murmur-api (Hono, better-auth)
    /llms.txt    → murmur-api (Hono)
    /robots.txt  → murmur-api (Hono)
    /feed.xml    → murmur-api (Hono)
    /sitemap.xml → murmur-api (Hono)
    /admin/*     → murmur-admin (vinext Worker，无 D1 绑定)
    /*           → murmur-portal (TanStack Start Worker，前台兜底，无 D1 绑定)

所有部署单元都是 Cloudflare Workers，不使用 Pages。多个 route 命中时边缘按最长前缀匹配
选一个 Worker 执行。无需代理代码，Cloudflare 边缘路由原生完成分发。
```

---

## Phase 0: Monorepo 骨架 + 基础设施（预计 2-3h）

### 步骤 0.1：初始化 Monorepo

```bash
mkdir murmur && cd murmur
git init
pnpm init
```

创建 `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

创建根 `package.json`:

```json
{
  "name": "murmur",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "typecheck": "pnpm -r exec tsc --noEmit",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3.0",
    "@vitest/coverage-v8": "^3.0",
    "playwright": "^1.50",
    "@playwright/test": "^1.50"
  }
}
```

创建 `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

创建 `.gitignore`:

```
node_modules/
dist/
.wrangler/
.env
*.log
```

**验证**: `pnpm install` 成功。

### 步骤 0.2：初始化共享包 `packages/db`

**已废弃**: 数据库读写仅限`murmur-api`，因此db操作集成在其中即可。

```bash
mkdir -p packages/db/src
cd packages/db && pnpm init
```

`packages/db/package.json`:

```json
{
  "name": "@murmur/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.38"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "vitest": "^3.0"
  }
}
```

将 PLAN.md 四.1 中的 Schema 代码写入 `packages/db/src/schema.ts`。

`packages/db/src/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDb(d1Binding: D1Database) {
  return drizzle(d1Binding, { schema });
}
```

`packages/db/src/index.ts`:

```typescript
export * from "./schema";
export { createDb } from "./client";
```

`packages/db/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    databaseId: process.env.CF_DATABASE_ID!,
    accountId: process.env.CF_ACCOUNT_ID!,
    token: process.env.CF_API_TOKEN!,
  },
});
```

### 步骤 0.3：初始化共享包 `packages/api-types`

```bash
mkdir -p packages/api-types/src && cd packages/api-types && pnpm init
```

`packages/api-types/package.json`:

```json
{
  "name": "@murmur/api-types",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

将 PLAN.md 六.3 中的类型定义（`SnippetListItem`、`SnippetDetail`、`PaginatedResponse`）写入 `packages/api-types/src/index.ts`。

### 步骤 0.4：初始化共享包 `packages/config`

```bash
mkdir -p packages/config/src && cd packages/config && pnpm init
```

`packages/config/package.json`:

```json
{
  "name": "@murmur/config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

`packages/config/src/site.ts`:

```typescript
export const siteConfig = {
  title: "Murmur — 碎碎念",
  description: "Short technical notes and TILs",
  domain: "m.o0x0o.com",
  author: "Jonirrings",
  language: "zh-CN",
  apiBase: "https://m.o0x0o.com",
} as const;

export function isInternalLink(href: string): boolean {
  return href.startsWith("/") || href.startsWith("https://m.o0x0o.com");
}
```

`packages/config/src/index.ts`:

```typescript
export { siteConfig, isInternalLink } from "./site";
```

### 步骤 0.5：Cloudflare 基础设施创建

```bash
# 创建 D1 数据库
wrangler d1 create murmur-db

# 创建 R2 存储桶
wrangler r2 bucket create murmur-assets

# 记录输出的 database_id，后续填入 wrangler.jsonc
```

**验证**: Cloudflare Dashboard → Workers & Pages → D1 确认 `murmur-db` 存在。

### 步骤 0.6：D1 FTS5 POC 验证

在 `packages/db/src/__tests__/fts5.test.ts` 中编写 FTS5 功能验证：

```typescript
import { describe, it, expect } from "vitest";

describe("FTS5", () => {
  it("unicode61 tokenizer handles CJK characters", () => {
    // 验证中文逐字匹配行为
  });

  it("MATCH query syntax", () => {
    // SELECT * FROM snippets_fts WHERE snippets_fts MATCH 'keyword'
  });

  it("triggers sync on INSERT/UPDATE/DELETE", () => {
    // 模拟 CRUD 后 FTS5 索引一致性
  });
});
```

**验证**: `pnpm --filter @murmur/db test` FTS5 POC 测试通过。

### 步骤 0.7：GitHub CI 测试流水线

创建 `.github/workflows/test.yml` — 将 PLAN.md 十三.5 中的 CI 配置写入。

**验证**: `git push` 后 GitHub Actions 自动运行。

---

## Phase 1: API Worker — murmur-api（预计 3-5h）

### 步骤 1.1：脚手架 murmur-api

```bash
mkdir -p apps/api/src && cd apps/api && pnpm init
pnpm create hono@latest . --template cloudflare-workers
```

`apps/api/package.json` 核心依赖：

```json
{
  "name": "@murmur/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.0",
    "drizzle-orm": "^0.38",
    "better-auth": "^1.0",
    "zod": "^3.24",
    "@hono/zod-validator": "^0.4",
    "@murmur/db": "workspace:*",
    "@murmur/api-types": "workspace:*",
    "@murmur/config": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0",
    "wrangler": "^3.100",
    "vitest": "^3.0"
  }
}
```

### 步骤 1.2：wrangler.jsonc 配置

创建 `apps/api/wrangler.jsonc`:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/cloudflare/workers-sdk/main/packages/wrangler/config-schema.json",
  "name": "murmur-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-07-01",

  "workers_dev": false,
  "routes": [
    { "pattern": "m.o0x0o.com/api/*", "zone_id": "<your-zone-id>" },
    { "pattern": "m.o0x0o.com/auth/*", "zone_id": "<your-zone-id>" },
    { "pattern": "m.o0x0o.com/llms.txt", "zone_id": "<your-zone-id>" },
    { "pattern": "m.o0x0o.com/robots.txt", "zone_id": "<your-zone-id>" },
    { "pattern": "m.o0x0o.com/feed.xml", "zone_id": "<your-zone-id>" },
    { "pattern": "m.o0x0o.com/sitemap.xml", "zone_id": "<your-zone-id>" },
  ],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "murmur-db",
      "database_id": "<your-database-id>",
    },
  ],

  "r2_buckets": [
    {
      "binding": "ASSETS",
      "bucket_name": "murmur-assets",
    },
  ],
}
```

> 将 `<your-zone-id>` 和 `<your-database-id>` 替换为实际值。

### 步骤 1.3：Hono 入口 + 路由注册

创建 `apps/api/src/index.ts`：

```typescript
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

// 注意：无需代理 /admin/* 和 /*——它们分别由 murmur-admin 和 murmur-portal
// 两个独立 Worker 通过各自的 routes 声明接管。Cloudflare Worker Routes 按最长
// 前缀匹配分发：/api/* 和 /auth/* 命中 murmur-api，/admin/* 命中 murmur-admin，
// 其余请求由 murmur-portal（/* 兜底）处理。

export default app;
```

> **与反向代理方案的对比**：不再需要 `app.all("/admin/*", ...)` 和 `app.all("/*", ...)` 代理中间件。Cloudflare 边缘路由自动将 `/admin/*` 发给 admin Worker，`/*` 发给前台 portal Worker。

### 步骤 1.4：实现中间件

按顺序创建以下文件：

| 文件                                        | 功能                               |
| ------------------------------------------- | ---------------------------------- |
| `apps/api/src/middleware/db.ts`             | `c.set("db", createDb(c.env.DB))`  |
| `apps/api/src/middleware/auth.ts`           | `c.get("session")` 校验            |
| `apps/api/src/middleware/error.ts`          | `try/catch` 统一 JSON 错误         |
| `apps/api/src/middleware/rate-limit.ts`     | 内存 Map 令牌桶（PLAN.md 十.2）    |
| `apps/api/src/middleware/content-signal.ts` | 全局 3 行 header（PLAN.md 十一.6） |

### 步骤 1.5：实现公开 API 路由

**⚠️ 公开 API 使用 `:slug` 作为标识符，不是 `:id`。**

| 路由文件                    | 端点                                 | 关键点                            |
| --------------------------- | ------------------------------------ | --------------------------------- |
| `routes/public/snippets.ts` | `GET /api/public/snippets`           | 分页、标签筛选、仅 `published`    |
|                             | `GET /api/public/snippets/:slug`     | 带 `contentMd`，支持 `?format=md` |
|                             | `GET /api/public/snippets/:slug/raw` | Markdown 原文                     |
| `routes/public/tags.ts`     | `GET /api/public/tags`               | 含每个标签的碎片计数              |
| `routes/public/search.ts`   | `GET /api/public/search?q=`          | FTS5 MATCH 查询                   |

每实现一个路由文件，立即编写对应的集成测试（见 1.8）。

### 步骤 1.6：实现管理 API 路由

**⚠️ 管理 API 使用 `:id`（数字主键），不是 `:slug`。务必区分。**

| 路由文件                   | 端点                             | 关键点                             |
| -------------------------- | -------------------------------- | ---------------------------------- |
| `routes/admin/snippets.ts` | `GET /api/admin/snippets`        | 含 `draft`/`archived`              |
|                            | `POST /api/admin/snippets`       | Zod 校验 + 自动生成 excerpt + slug |
|                            | `PUT /api/admin/snippets/:id`    | 使用 `:id` 精确匹配                |
|                            | `DELETE /api/admin/snippets/:id` | 级联删除关联                       |
| `routes/admin/tags.ts`     | CRUD                             | 基本 CRUD                          |
| `routes/admin/media.ts`    | `POST /api/admin/media/upload`   | R2 `put()`                         |
| `routes/admin/stats.ts`    | `GET /api/admin/stats`           | 聚合查询                           |

### 步骤 1.7：实现静态文件路由

创建 `routes/static.ts`，四个 handler：

| 路由           | 格式                   | 关键点                  |
| -------------- | ---------------------- | ----------------------- |
| `/llms.txt`    | `text/plain`           | 所有 published 碎片链接 |
| `/robots.txt`  | `text/plain`           | 欢迎所有爬虫            |
| `/sitemap.xml` | `application/xml`      | `<urlset>` 格式         |
| `/feed.xml`    | `application/atom+xml` | Atom Feed，最新 20 条   |

### 步骤 1.8：实现数据导出/导入

`routes/admin/export.ts`：认证后返回完整 JSON 快照（`version`, `exportedAt`, `snippets`, `tags`, `snippetsToTags`），带 `Content-Disposition: attachment`。

`routes/admin/import.ts`：接受 JSON、校验 `version` 字段、事务中逐条 `INSERT OR IGNORE`、返回统计。

### 步骤 1.9：编写 API 集成测试

创建 `apps/api/src/__tests__/` 目录：

```typescript
// __tests__/snippets.test.ts
import { describe, it, expect } from "vitest";
import app from "../index";

describe("GET /api/public/snippets", () => {
  it("returns 200 with paginated published snippets", async () => {
    const res = await app.request("/api/public/snippets?page=1&pageSize=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("excludes draft/archived from public list", async () => {
    const res = await app.request("/api/public/snippets");
    const body = await res.json();
    for (const item of body.items) {
      expect(item.status).toBeUndefined();
    }
  });
});

describe("GET /api/public/snippets/:slug", () => {
  it("returns snippet detail with contentMd", async () => {
    /* ... */
  });
  it("returns 404 for nonexistent slug", async () => {
    /* ... */
  });
  it("returns markdown when ?format=md", async () => {
    /* ... */
  });
});

describe("POST /api/admin/snippets (auth)", () => {
  it("rejects unauthenticated with 401", async () => {
    /* ... */
  });
});

describe("Rate Limiting", () => {
  it("returns 429 after exceeding per-IP limit", async () => {
    const requests = Array.from({ length: 11 }, () =>
      app.request("/auth/login", { method: "POST" }),
    );
    const results = await Promise.all(requests);
    expect(results.some((r) => r.status === 429)).toBe(true);
  });

  it("sets X-RateLimit-* headers", async () => {
    const res = await app.request("/api/public/snippets");
    expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
  });
});
```

**验证**: `pnpm --filter @murmur/api test` 全部通过。

### 步骤 1.10：部署 murmur-api

```bash
cd apps/api
pnpm run deploy
```

**验证**: `curl https://m.o0x0o.com/api/public/snippets` → `{"items":[],"total":0,...}`。

---

## Phase 2: Admin Worker — murmur-admin（预计 3-4h）

### 步骤 2.1：脚手架 vinext Worker 项目

```bash
mkdir -p apps/admin && cd apps/admin && pnpm init
# 按照 vinext README 初始化 Cloudflare Workers 项目
# https://github.com/cloudflare/vinext
```

`apps/admin/package.json` 核心依赖：

```json
{
  "name": "@murmur/admin",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinext dev",
    "build": "vinext build",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0",
    "react-dom": "^19.0",
    "@murmur/api-types": "workspace:*",
    "@murmur/config": "workspace:*",
    "@tanstack/react-query": "^5.0",
    "@uiw/react-codemirror": "^4.0",
    "@codemirror/lang-markdown": "^6.0",
    "shiki": "^1.0",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "vinext": "latest",
    "typescript": "^5.7",
    "@types/react": "^19.0",
    "@testing-library/react": "^16.0",
    "vitest": "^3.0",
    "wrangler": "^3.100"
  }
}
```

### 步骤 2.2：wrangler.jsonc 配置

创建 `apps/admin/wrangler.jsonc`:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/cloudflare/workers-sdk/main/packages/wrangler/config-schema.json",
  "name": "murmur-admin",
  "main": "src/index.ts",
  "compatibility_date": "2025-07-01",
  "compatibility_flags": ["nodejs_compat"],

  "workers_dev": false,
  "routes": [{ "pattern": "m.o0x0o.com/admin/*", "zone_id": "<your-zone-id>" }],

  // Admin Worker 不绑定 D1/R2。
  // 所有数据操作通过调用 https://m.o0x0o.com/api/admin/* 完成。
  // Worker Routes 优先级确保 /admin/* 先到达此 Worker，
  // 不会与 murmur-api 的 /api/* 冲突。
}
```

### 步骤 2.3：登录页

```tsx
// apps/admin/src/app/login/page.tsx
"use client";
import { signIn } from "better-auth/react";

export default function LoginPage() {
  return (
    <div class="flex min-h-screen items-center justify-center">
      <div class="w-full max-w-sm space-y-4">
        <h1 class="text-2xl font-bold">Murmur Admin</h1>
        <button onClick={() => signIn("github")}>Sign in with GitHub</button>
      </div>
    </div>
  );
}
```

### 步骤 2.4：仪表盘

`apps/admin/src/app/page.tsx` — 调用 `/api/admin/stats`，展示：

- 碎片总数 / 已发布 / 草稿 / 已归档
- 标签总数
- 近 7 天发布趋势

### 步骤 2.5：Markdown 编辑器

`apps/admin/src/components/editor.tsx` — `@uiw/react-codemirror` + GFM 扩展 + 右侧实时预览（shiki 高亮）。

### 步骤 2.6：碎片管理页面

> **⚠️ 注意**：管理 API 使用数字 `:id`。路由参数命名、API 调用全部使用 `id`，不是 `slug`。

| 页面路由                   | 功能                                    |
| -------------------------- | --------------------------------------- |
| `/admin/snippets`          | 列表（含 draft/archived 筛选）          |
| `/admin/snippets/new`      | 新建（编辑器 + 标签选择 + 状态/可见性） |
| `/admin/snippets/:id/edit` | 编辑（`:id` 加载，`PUT :id` 提交）      |

### 步骤 2.7：标签管理 + 媒体管理

| 页面路由               | 功能                           |
| ---------------------- | ------------------------------ |
| `/admin/tags`          | 标签列表                       |
| `/admin/tags/new`      | 新建（slug、名称、描述、色值） |
| `/admin/tags/:id/edit` | 编辑                           |
| `/admin/media`         | 上传 + 列表 + 复制 R2 URL      |

### 步骤 2.8：数据导出/导入页面

`apps/admin/src/app/admin/backup/page.tsx`:

```tsx
export default function BackupPage() {
  const handleExport = async () => {
    const res = await fetch("/api/admin/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `murmur-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    });
    const result = await res.json();
    alert(`Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
  };

  return (
    <div>
      <h1>数据备份</h1>
      <button onClick={handleExport}>导出 JSON</button>
      <input
        type="file"
        accept=".json"
        onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
      />
    </div>
  );
}
```

### 步骤 2.9：部署 murmur-admin

```bash
cd apps/admin
pnpm run build
pnpm run deploy   # wrangler deploy
```

**验证**: 访问 `https://m.o0x0o.com/admin` → Admin 登录页显示。

---

## Phase 3: 前台 Worker — murmur-portal（预计 3-4h）

### 步骤 3.1：脚手架 TanStack Start (Solid) 项目

```bash
mkdir -p apps/portal && cd apps/portal && pnpm init
# 按 TanStack Start Solid 文档初始化:
# https://tanstack.com/start/latest/docs/framework/solid/overview
```

`apps/portal/package.json`:

```json
{
  "name": "@murmur/portal",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/start": "^1.0",
    "@tanstack/solid-router": "^1.0",
    "@tanstack/solid-query": "^5.0",
    "solid-markdown": "^3.0",
    "rehype-shiki": "^1.0",
    "shiki": "^1.0",
    "@murmur/api-types": "workspace:*",
    "@murmur/config": "workspace:*"
  },
  "devDependencies": {
    "vinxi": "latest",
    "typescript": "^5.7",
    "vitest": "^3.0",
    "@solidjs/testing-library": "^0.8",
    "jsdom": "^25.0",
    "wrangler": "^3.100"
  }
}
```

### 步骤 3.2：wrangler.jsonc 配置

创建 `apps/portal/wrangler.jsonc`:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/cloudflare/workers-sdk/main/packages/wrangler/config-schema.json",
  "name": "murmur-portal",
  "main": ".output/server/index.js",
  "compatibility_date": "2025-07-01",
  "compatibility_flags": ["nodejs_compat"],

  "workers_dev": false,
  "routes": [
    { "pattern": "m.o0x0o.com", "zone_id": "<your-zone-id>" }, // 根路径
    { "pattern": "m.o0x0o.com/*", "zone_id": "<your-zone-id>" }, // 前台其余路径（兜底）
  ],

  // 前台 Worker 不绑定 D1/R2。
  // 所有数据操作通过调用 https://m.o0x0o.com/api/public/* 完成。
}
```

> `main` 指向 TanStack Start / Vinxi 的 Cloudflare Workers 构建产物（以实际 adapter 输出为准）。

### 步骤 3.3：定义 TanStack Router 文件路由

使用 `createFileRoute` from `@tanstack/solid-router`：

```
apps/portal/src/routes/
├── __root.tsx          # 根布局（Header + Footer）
├── index.tsx           # 首页碎片流
├── post.$slug.tsx      # 碎片详情
├── tags.tsx            # 标签云
└── tags.$slug.tsx      # 按单标签筛选（可选）
```

**`routes/__root.tsx`** — 根布局：

```tsx
import { createRootRoute, Link, Outlet } from "@tanstack/solid-router";

export const Route = createRootRoute({
  component: () => (
    <div class="min-h-screen bg-white dark:bg-gray-950">
      <header class="border-b px-4 py-3">
        <nav class="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" class="text-lg font-bold">
            murmur / 碎碎念
          </Link>
          <div class="flex gap-4">
            <Link to="/tags">标签云</Link>
            <a href="/feed.xml">RSS</a>
          </div>
        </nav>
      </header>
      <main class="mx-auto max-w-2xl px-4 py-8">
        <Outlet />
      </main>
      <footer class="border-t px-4 py-6 text-center text-sm text-gray-500">
        © Jonirrings · <a href="/feed.xml">RSS</a> · Powered by Murmur
      </footer>
    </div>
  ),
});
```

**`routes/index.tsx`** — 首页：

```tsx
import { createFileRoute } from "@tanstack/solid-router";
import { createQuery } from "@tanstack/solid-query";
import type { PaginatedResponse, SnippetListItem } from "@murmur/api-types";

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, string>) => ({
    page: Number(search.page) || 1,
    q: search.q || "",
    tag: search.tag || "",
  }),
});

function HomePage() {
  const search = Route.useSearch();
  const query = createQuery(() => ({
    queryKey: ["snippets", search().page, search().q, search().tag],
    queryFn: () =>
      fetch(`/api/public/snippets?page=${search().page}&q=${search().q}&tag=${search().tag}`).then(
        (r) => r.json(),
      ) as Promise<PaginatedResponse<SnippetListItem>>,
  }));
  // 渲染碎片列表卡片 + 分页
}
```

**`routes/post.$slug.tsx`** — 详情页：

```tsx
import { createFileRoute } from "@tanstack/solid-router";
import { createQuery } from "@tanstack/solid-query";
import type { SnippetDetail } from "@murmur/api-types";
import { MurmurContent } from "../components/MurmurContent";

export const Route = createFileRoute("/post/$slug")({
  component: PostPage,
  head: ({ params }) => ({
    title: `Murmur — ${params.slug}`,
    meta: [
      { name: "description", content: "..." },
      { property: "og:title", content: `Murmur — ${params.slug}` },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "alternate", type: "application/atom+xml", href: "/feed.xml" }],
  }),
});

function PostPage() {
  const params = Route.useParams();
  const query = createQuery(() => ({
    queryKey: ["snippet", params().slug],
    queryFn: () =>
      fetch(`/api/public/snippets/${params().slug}`).then((r) =>
        r.json(),
      ) as Promise<SnippetDetail>,
  }));

  return (
    <article>
      <h1 class="text-2xl font-bold">{query.data?.title}</h1>
      <div class="flex gap-2 my-2">
        {query.data?.tags.map((tag) => (
          <a href={`/?tag=${tag.slug}`} class="tag-badge">
            #{tag.name}
          </a>
        ))}
      </div>
      <MurmurContent contentMd={query.data?.contentMd ?? ""} />
    </article>
  );
}
```

### 步骤 3.4：MurmurContent 组件

`apps/portal/src/components/MurmurContent.tsx` — 使用 `solid-markdown` + `rehype-shiki`：

- 内部链接 → `<Link>`（TanStack Router 客户端导航）
- 外部链接 → `target="_blank" rel="noopener"`
- 代码块 → shiki `github-dark` 主题

### 步骤 3.5：标签云页 + 搜索

`routes/tags.tsx` — 所有标签 + 每个标签下最新 3 条碎片。
首页顶部搜索框，通过 `validateSearch` + `useNavigate` 驱动 URL 参数。

### 步骤 3.6：组件测试

```typescript
// apps/portal/src/components/__tests__/MurmurContent.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { MurmurContent } from "../MurmurContent";

describe("MurmurContent", () => {
  it("renders GFM markdown", () => {
    /* ... */
  });
  it("renders code blocks with shiki", () => {
    /* ... */
  });
  it("converts internal links to router Link", () => {
    /* ... */
  });
  it("opens external links in new tab", () => {
    /* ... */
  });
});
```

### 步骤 3.7：部署 murmur-portal Worker

```bash
cd apps/portal
pnpm run build

# 部署为 Cloudflare Worker（wrangler.jsonc 中已声明根路径 + /* 兜底 routes）
pnpm run deploy   # wrangler deploy
```

**验证路由共存**:

```bash
# API 请求到达 murmur-api Worker
curl https://m.o0x0o.com/api/public/snippets

# Admin 请求到达 murmur-admin Worker
curl https://m.o0x0o.com/admin

# 前台页面命中 murmur-portal Worker（/* 兜底）
curl https://m.o0x0o.com/
curl https://m.o0x0o.com/post/hello
```

---

## Phase 4: AI 友好性与上线（预计 2-3h）

### 步骤 4.1：llms.txt + 内容协商

已在 Phase 1.7 实现（`routes/static.ts`）。

**验证**:

```bash
curl https://m.o0x0o.com/llms.txt
curl https://m.o0x0o.com/api/public/snippets/hello?format=md
curl -H "Accept: text/markdown" https://m.o0x0o.com/api/public/snippets/hello
```

### 步骤 4.2：robots.txt + sitemap.xml + feed.xml

已在 Phase 1.7 实现。

**验证**:

```bash
curl https://m.o0x0o.com/robots.txt
curl https://m.o0x0o.com/sitemap.xml
curl https://m.o0x0o.com/feed.xml
```

### 步骤 4.3：JSON-LD + Content-Signal

- JSON-LD：在 `GET /api/public/snippets/:slug` 的 JSON 响应中附带 `jsonLd` 字段
- Content-Signal：已在 Phase 1.4 实现

**验证**: `curl -I https://m.o0x0o.com/api/public/snippets | grep content-signal`

### 步骤 4.4：E2E 测试（Playwright）

```bash
mkdir -p e2e
pnpm playwright install
```

创建 `e2e/murmur.spec.ts` + `playwright.config.ts`，覆盖：

1. 首页显示碎片列表
2. 点击标题跳转详情页
3. 标签筛选生效
4. 搜索返回结果
5. Admin 未登录时跳转登录页

**验证**: `pnpm test:e2e`

### 步骤 4.5：正式上线

- [ ] DNS：`m.o0x0o.com` 在 Cloudflare 中 proxied（橙色云朵）
- [ ] Worker Routes 已配置（api + admin + solid）
- [ ] `curl https://m.o0x0o.com/api/public/snippets` → 200
- [ ] 浏览器访问 `https://m.o0x0o.com/` → 前台显示
- [ ] 浏览器访问 `https://m.o0x0o.com/admin` → 登录页显示
- [ ] GitHub OAuth 登录 → 跳转后台仪表盘
- [ ] 发布一条测试碎片 → 前台可见

### 步骤 4.6：撰写 README.md

````markdown
# Murmur — 碎碎念

Short technical notes and TILs at [m.o0x0o.com](https://m.o0x0o.com).

## Architecture

m.o0x0o.com
├── /api/* /auth/* → murmur-api (Hono Worker) + D1 + R2
├── /admin/* → murmur-admin (vinext Worker)
└── /* → murmur-portal (TanStack Start Worker)

3 个 Cloudflare Workers 按 Worker Route 最长前缀匹配分发，不使用 Pages。
murmur-api 是唯一持有 D1/R2 写权限的单元，admin 与 portal 均无 D1 绑定。

## Local Development

```bash
pnpm install
pnpm dev
```
````

## Deploy

```bash
pnpm -r deploy
```

```

---

## 附录 A: Phase 依赖关系

```

Phase 0 (基础设施)
└── Phase 1 (murmur-api Worker)
├── Phase 2 (murmur-admin Worker)
└── Phase 3 (murmur-portal Worker)
└── Phase 4 (E2E 测试 + 上线)

```

- Phase 1 完成后，Phase 2 和 Phase 3 **可以并行开发**
- Phase 3 部署后立即验证路由共存（步骤 3.7）
- Phase 4 E2E 测试依赖 Phase 1-3 全部部署完成

## 附录 B: 文件创建清单

```

Phase 0:
murmur/pnpm-workspace.yaml
murmur/package.json
murmur/tsconfig.base.json
murmur/.gitignore
murmur/packages/db/package.json
murmur/packages/db/src/schema.ts
murmur/packages/db/src/client.ts
murmur/packages/db/src/index.ts
murmur/packages/db/drizzle.config.ts
murmur/packages/api-types/package.json
murmur/packages/api-types/src/index.ts
murmur/packages/config/package.json
murmur/packages/config/src/site.ts
murmur/packages/config/src/index.ts
murmur/.github/workflows/test.yml

Phase 1 (murmur-api Worker):
murmur/apps/api/package.json
murmur/apps/api/tsconfig.json
murmur/apps/api/wrangler.jsonc
murmur/apps/api/src/index.ts
murmur/apps/api/src/middleware/db.ts
murmur/apps/api/src/middleware/auth.ts
murmur/apps/api/src/middleware/error.ts
murmur/apps/api/src/middleware/rate-limit.ts
murmur/apps/api/src/middleware/content-signal.ts
murmur/apps/api/src/routes/static.ts
murmur/apps/api/src/routes/auth.ts
murmur/apps/api/src/routes/public/snippets.ts
murmur/apps/api/src/routes/public/tags.ts
murmur/apps/api/src/routes/public/search.ts
murmur/apps/api/src/routes/admin/snippets.ts
murmur/apps/api/src/routes/admin/tags.ts
murmur/apps/api/src/routes/admin/media.ts
murmur/apps/api/src/routes/admin/stats.ts
murmur/apps/api/src/routes/admin/export.ts
murmur/apps/api/src/routes/admin/import.ts
murmur/apps/api/src/**tests**/snippets.test.ts
murmur/apps/api/src/**tests**/tags.test.ts
murmur/apps/api/src/**tests**/auth.test.ts
murmur/apps/api/src/**tests**/rate-limit.test.ts
murmur/.github/workflows/deploy-api.yml

Phase 2 (murmur-admin Worker):
murmur/apps/admin/package.json
murmur/apps/admin/tsconfig.json
murmur/apps/admin/wrangler.jsonc
murmur/apps/admin/src/app/layout.tsx
murmur/apps/admin/src/app/page.tsx
murmur/apps/admin/src/app/login/page.tsx
murmur/apps/admin/src/app/admin/snippets/page.tsx
murmur/apps/admin/src/app/admin/snippets/new/page.tsx
murmur/apps/admin/src/app/admin/snippets/[id]/edit/page.tsx
murmur/apps/admin/src/app/admin/tags/page.tsx
murmur/apps/admin/src/app/admin/tags/new/page.tsx
murmur/apps/admin/src/app/admin/tags/[id]/edit/page.tsx
murmur/apps/admin/src/app/admin/media/page.tsx
murmur/apps/admin/src/app/admin/backup/page.tsx
murmur/apps/admin/src/components/editor.tsx
murmur/apps/admin/src/components/**tests**/editor.test.tsx
murmur/.github/workflows/deploy-admin.yml

Phase 3 (murmur-portal Worker):
murmur/apps/portal/package.json
murmur/apps/portal/tsconfig.json
murmur/apps/portal/app.config.ts
murmur/apps/portal/wrangler.jsonc
murmur/apps/portal/src/routes/__root.tsx
murmur/apps/portal/src/routes/index.tsx
murmur/apps/portal/src/routes/post.$slug.tsx
murmur/apps/portal/src/routes/tags.tsx
murmur/apps/portal/src/components/MurmurContent.tsx
murmur/apps/portal/src/components/SnippetCard.tsx
murmur/apps/portal/src/components/SearchBar.tsx
murmur/apps/portal/src/components/**tests**/MurmurContent.test.tsx
murmur/.github/workflows/deploy-portal.yml

Phase 4:
murmur/e2e/murmur.spec.ts
murmur/playwright.config.ts
murmur/README.md

```

## 附录 C: 部署架构对比

| 方面 | 原反向代理方案 | 当前 3-Worker 方案 |
|------|-------------|------------------|
| 入口 | Worker 接管全部流量然后 fetch Pages | 边缘路由直接分发到 3 个 Worker 各自目的地 |
| 额外延迟 | +1 跳（Worker → Pages） | 0 |
| 代理代码 | 需要维护 `app.all("/admin/*", ...)` 和 `app.all("/*", ...)` | 零代理代码 |
| 配置复杂度 | 需要 env vars 传 Pages URL | 各 Worker 的 routes 在 wrangler.jsonc 中声明 |
| Worker 额度消耗 | 前台每个请求消耗 1 次 Worker | 3 个 Worker 共享账户级额度（前台也是 Worker） |
| 数据库访问 | 单一 API 入口 | 仅 murmur-api 持有 D1/R2 写 binding，admin/solid 经 HTTP |
| 路由控制 | 代码层（Hono 路由） | 基础设施层（Cloudflare 边缘最长前缀匹配） |
| 部署独立性 | Worker 发新版需确保代理不变 | 三个 Worker 完全独立部署 |

## 附录 D: 关键验证点

| # | 验证点 | 方法 | Phase |
|---|--------|------|-------|
| 1 | Monorepo 结构正确 | `ls packages/ apps/` | 0 |
| 2 | FTS5 索引可用 | `curl /api/public/search?q=test` | 1 |
| 3 | Rate limit 生效 | 连续 11 次 POST `/auth/login` → 第 11 次 429 | 1 |
| 4 | 公开 API `:slug` vs 管理 API `:id` | code review | 1 |
| 5 | Admin Worker Routes 隔离 | `curl /admin` 不被 api Worker 处理 | 2 |
| 6 | 导出/导入功能 | 浏览器下载 JSON + 上传恢复 | 2 |
| 7 | 前台 Markdown 渲染 | 访问详情页，代码高亮 + GFM 正确 | 3 |
| 8 | 三个 Worker routes 共存 | `/admin` → admin Worker, `/post/x` → portal Worker（/* 兜底） | 3 |
| 9 | llms.txt / robots.txt / feed.xml | `curl` 返回正确内容 | 4 |
| 10 | Content negotiation 生效 | `curl -H "Accept: text/markdown"` | 4 |
```
