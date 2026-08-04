# Murmur — 碎碎念 · 技术资料整合站

> 灵感来自 [til.adoyle.me](https://til.adoyle.me/)。
> 记录日常遇到的技术问题和查到的资料，聚合在一起方便回顾和搜索。

## 一、项目定位

轻量、聚焦**短篇技术笔记**的知识记录站。每则 murmur 是一段 Markdown，表达一个完整的知识点或踩坑记录。

**核心理念：**

- **Markdown 贯穿全链路**：用 CodeMirror 写 GFM Markdown → 数据库存 Markdown → API 返回 Markdown → 前端渲染 Markdown。零转换、零同步风险
- **单页模式**：一个列表页 + 详情页，类微博/碎碎念风格，无侧边栏、无评论
- **标签驱动的信息架构**：无分类层级，通过标签筛选触达所有内容
- **TanStack 全家桶前台 + vinext (React) 后台**：前台使用 TanStack Start + TanStack Router + TanStack Solid Query 全系产品，后端复用了同样的 TanStack Query 设计但运行在 Hono 上
- **全站 Cloudflare**：独立域名 `m.o0x0o.com`，独立 D1 数据库，独立 Workers + Pages

---

## 二、站点架构

```
                    ┌───────────────────────────────────┐
                    │     m.o0x0o.com                   │
                    │     (Cloudflare Pages)            │
                    │                                   │
                    │     / → 前台 (TanStack Start)     │
                    │     /admin → 后台 (vinext)        │
                    └──────────────┬────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────────────┐
                    │  murmur-api (Hono Worker)         │
                    │  m.o0x0o.com/api/*                 │
                    │                                   │
                    │  ┌─────────────────────────────┐  │
                    │  │  /api/public/snippets       │  │
                    │  │  /api/public/tags           │  │
                    │  │  /api/public/search         │  │
                    │  │  /api/admin/* (需 auth)     │  │
                    │  │  /auth/* (better-auth)      │  │
                    │  └─────────────────────────────┘  │
                    └──────────────┬────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────────────┐
                    │  Cloudflare D1 (murmur-db)        │
                    │  + R2 (murmur-assets)             │
                    │  (drizzle-orm)                    │
                    │                                   │
                    │  ┌─────────────────────────────┐  │
                    │  │  snippets / tags            │  │
                    │  │  snippet_tags / sessions    │  │
                    │  │  media                      │  │
                    │  │  snippets_fts (FTS5)        │  │
                    │  └─────────────────────────────┘  │
                    └───────────────────────────────────┘
```

### 2.1 Site & API Inventory

| Entry          | Framework              | Type        | Description                                   |
| -------------- | ---------------------- | ----------- | --------------------------------------------- |
| **murmur-api** | Hono (Worker)          | API server  | All `/api/*` routes + `/auth/*` (better-auth) |
| **/admin**     | vinext (React)         | Admin panel | Write snippets, manage tags, upload media     |
| **/**          | TanStack Start (Solid) | User Portal | Public site (read only)                       |

### 2.2 部署拓扑

```
Cloudflare Workers:
└── murmur-api (Hono)               → m.o0x0o.com/api/* + /auth/*
    ├── 绑定 D1 (murmur-db)
    ├── 绑定 R2 (murmur-assets)
    └── 唯一拥有 D1 写权限的部署单元

Cloudflare Pages 项目:
├── murmur-portal (TanStack Start)   → m.o0x0o.com/
└── murmur-admin (vinext)           → m.o0x0o.com/admin

Cloudflare D1:
└── murmur-db — 单独实例，与 blog 无关

Cloudflare R2:
└── murmur-assets — 单独 bucket
```

### 2.3 路由分配

```
Worker Route（murmur-api，优先级最高）:
  /api/*      → murmur-api Worker
  /auth/*     → murmur-api Worker (better-auth)
  /llms.txt   → murmur-api Worker
  /robots.txt → murmur-api Worker
  /feed.xml   → murmur-api Worker
  /sitemap.xml → murmur-api Worker

Pages 自定义域名路径绑定:
  /admin/*    → murmur-admin 项目
  /           → murmur-portal 项目
```

---

## 三、技术栈

### 3.1 全站共享层

| 层次     | 选型                           | 说明                                               |
| -------- | ------------------------------ | -------------------------------------------------- |
| API 框架 | **Hono**                       | 超轻量路由 (~14KB)，内置 Zod/CORS/JWT 中间件       |
| 数据库   | **Cloudflare D1**              | SQLite 兼容，零运维，独立实例 `murmur-db`          |
| ORM      | **Drizzle ORM**                | TypeScript-first，D1 原生支持 `drizzle-orm/sqlite` |
| 认证     | **better-auth**                | Drizzle ORM 集成（`drizzleAdapter`）               |
| 验证码   | **Cloudflare Turnstile**       | 免费无限量，评论/提交表单保护                      |
| 搜索     | **FTS5**                       | SQLite 内置全文索引，适合短文本                    |
| 代码高亮 | **shiki**                      | CodeMirror 编辑器中预览 + 前台渲染均使用 shiki     |
| 样式     | **Tailwind CSS v4**            | 自定义 Design Token                                |
| 部署     | **Cloudflare Pages + Workers** |                                                    |
| 存储     | **Cloudflare R2**              | 图片 + 附件，独立 bucket `murmur-assets`           |
| CI       | **GitHub Actions**             | 自动构建 + 部署                                    |

### 3.2 各站点技术栈

| 站点           | Web 框架               | 组件库       | API 客户端                        | 路由            |
| -------------- | ---------------------- | ------------ | --------------------------------- | --------------- |
| **murmur-api** | Hono (Worker)          | —            | D1 + drizzle-orm                  | Hono 文件路由   |
| **/admin**     | vinext (React)         | shadcn/ui    | TanStack Query → murmur-api       | App Router      |
| **/**          | TanStack Start (Solid) | shadcn-solid | TanStack Solid Query → murmur-api | TanStack Router |

---

## 四、数据模型（Drizzle Schema）

### 4.1 Schema 总览

```typescript
// packages/db/src/schema.ts

// ─── 碎片 ───
export const snippets = sqliteTable("snippets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull(), // Markdown 正文（唯一源）
  excerpt: text("excerpt"), // 自动生成：取前 200 字符
  language: text("language"), // 关联的语言/技术（可选，用于徽标）
  coverImage: text("cover_image"), // R2 对象键
  status: text("status", { enum: ["draft", "published", "archived"] })
    .default("draft")
    .notNull(),
  visibility: text("visibility", { enum: ["public", "unlisted", "private"] })
    .default("public")
    .notNull(),

  authorId: text("author_id").notNull(),
  publishedAt: text("published_at"),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").default(sql`(current_timestamp)`),
});

// ─── 标签 ───
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"), // Tailwind 颜色类名
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// ─── 碎片-标签 多对多 ───
export const snippetsToTags = sqliteTable(
  "snippets_to_tags",
  {
    snippetId: integer("snippet_id")
      .notNull()
      .references(() => snippets.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.snippetId, t.tagId] }),
  }),
);

// ─── 媒体 ───
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  r2Key: text("r2_key").notNull(),
  alt: text("alt"),
  uploadedBy: text("uploaded_by"),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});
```

### 4.2 FTS5 全文搜索索引

短篇知识碎片（50-300 字）用 FTS5 关键词匹配即可，比 Vectorize 语义搜索更高效：

```typescript
// FTS5 虚拟表定义（通过 drizzle-kit 自定义迁移创建）
//
// CREATE VIRTUAL TABLE snippets_fts USING fts5(
//   snippet_id UNINDEXED,
//   title,
//   content,
//   tokenize='unicode61'
// );
//
// 更新时通过触发器同步：
// CREATE TRIGGER snippets_ai AFTER INSERT ON snippets BEGIN
//   INSERT INTO snippets_fts(snippet_id, title, content)
//   VALUES (new.id, new.title, new.content_md);
// END;
//
// CREATE TRIGGER snippets_ad AFTER DELETE ON snippets BEGIN
//   INSERT INTO snippets_fts(snippets_fts, snippet_id, title, content)
//   VALUES('delete', old.id, old.title, old.content_md);
// END;
//
// CREATE TRIGGER snippets_au AFTER UPDATE ON snippets BEGIN
//   INSERT INTO snippets_fts(snippets_fts, snippet_id, title, content)
//   VALUES('delete', old.id, old.title, old.content_md);
//   INSERT INTO snippets_fts(snippet_id, title, content)
//   VALUES (new.id, new.title, new.content_md);
// END;
```

查询示例：

```typescript
// apps/api/src/lib/search.ts
const result = await c.env.DB.prepare(
  `
  SELECT snippets.*, rank
  FROM snippets_fts
  JOIN snippets ON snippets_fts.snippet_id = snippets.id
  WHERE snippets_fts MATCH ?
  AND snippets.status = 'published'
  ORDER BY rank
  LIMIT 20
`,
)
  .bind(query)
  .all();
```

| 方面             | FTS5                 | Vectorize                    |
| ---------------- | -------------------- | ---------------------------- |
| 响应时间         | < 10ms               | ~250ms（含 embedding 生成）  |
| 关键词搜索       | ✅ 精确匹配          | ✅ 语义关联                  |
| 中文分词         | `unicode61` 逐字匹配 | bge-base-en 英文为主         |
| 实现复杂度       | 3 个 SQL 触发器      | AI Worker + Vectorize upsert |
| 免费额度         | D1 查询内            | 100 万向量/月                |
| **适合短笔记？** | ✅                   | ⚠️ 对 50 字文本语义优势有限  |

### 4.3 better-auth + Drizzle ORM 集成

复用 blog 项目已验证的方案：

```typescript
// apps/api/src/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

export function createAuth(d1Binding: D1Database) {
  const db = drizzle(d1Binding);
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      github: { enabled: true, clientId: "...", clientSecret: "..." },
    },
  });
}
```

---

## 五、Markdown 编辑与渲染

### 5.1 编辑链路

```
Admin 编辑器（CodeMirror 6 + GFM）:
  → 输入 Markdown 字符串
  → POST /api/admin/snippets
  → murmur-api 存 contentMd
  → 自动生成 excerpt（前 200 字符）
  → 自动更新 FTS5 索引（SQL Trigger）
  → 前台 GET /api/public/snippets/:slug
  → solid-markdown 渲染
```

与 blog 的最大区别：**没有 Lexical JSON 层**。contentMd 是唯一源，不存在转换和同步问题。

### 5.2 Admin Markdown 编辑器

```tsx
// apps/admin/src/components/editor.tsx
import { useCodeMirror } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";

export function MarkdownEditor({ value, onChange }: Props) {
  const { setContainer } = useCodeMirror({
    container: null,
    value,
    extensions: [markdown({ base: markdownLanguage })],
    onChange,
  });
  return <div ref={setContainer} className="min-h-[400px]" />;
}
```

同时提供**实时预览**（右侧面板），预览按调用 shiki 做代码高亮，所见即所得。

### 5.3 GFM 支持范围

| 元素                       | 渲染方式                                           |
| -------------------------- | -------------------------------------------------- |
| 代码块 + 语言标识          | `shiki` 高亮（`github-dark` 主题）                 |
| 表格                       | GFM 表格原生 `<table>`                             |
| 任务列表 `- [ ]` / `- [x]` | 带 checkbox 样式                                   |
| 删除线 `~~text~~`          | `<del>`                                            |
| 自动链接 `<url>`           | `<a>` 外链                                         |
| 脚注 `[^1]`                | 页面底部自动生成脚注区                             |
| LaTeX                      | `remark-math` + `rehype-katex`（可选，需要再接入） |
| Mermaid                    | 如果后期有流程图需求再考虑                         |

### 5.4 前台渲染

```tsx
// apps/portal/src/components/MurmurContent.tsx
import { Markdown } from "solid-markdown";
import { Link } from "@tanstack/solid-router";
import { isInternalLink } from "@murmur/config";
import rehypeShiki from "rehype-shiki";

export function MurmurContent(props: { contentMd: string }) {
  return (
    <Markdown
      rehypePlugins={[[rehypeShiki, { theme: "github-dark" }]]}
      components={{
        a: (attrs) => {
          if (isInternalLink(attrs.href ?? ""))
            return <Link to={attrs.href}>{attrs.children}</Link>;
          return (
            <a href={attrs.href} target="_blank" rel="noopener">
              {attrs.children}
            </a>
          );
        },
      }}
    >
      {props.contentMd}
    </Markdown>
  );
}
```

---

## 六、REST API 设计

### 6.1 API 项目结构

```
apps/api/
├── src/
│   ├── index.ts                # Hono app 入口 + Worker fetch handler
│   ├── middleware/
│   │   ├── auth.ts             # better-auth 中间件
│   │   ├── db.ts               # D1 binding 注入
│   │   └── error.ts            # 统一错误处理
│   ├── routes/
│   │   ├── public/
│   │   │   ├── snippets.ts
│   │   │   ├── tags.ts
│   │   │   └── search.ts
│   │   └── admin/
│   │       ├── snippets.ts
│   │       ├── tags.ts
│   │       ├── media.ts
│   │       └── stats.ts
│   └── lib/
│       ├── db.ts               # drizzle-orm D1 client
│       └── response.ts         # 统一响应格式
├── wrangler.toml
└── package.json
```

### 6.2 API 端点

```
# ============ 公开 API（无需认证） ============

GET    /api/public/snippets                     # 碎片列表（分页、按标签筛选）
GET    /api/public/snippets/:slug               # 碎片详情
GET    /api/public/snippets/:slug/raw           # Markdown 原文（?format=md 等价）
GET    /api/public/tags                         # 标签列表（含碎片数）
GET    /api/public/search?q=keyword             # FTS5 全文搜索

# ============ 管理 API（需 better-auth session）============

GET    /api/admin/snippets                      # 碎片列表（含草稿、所有状态）
POST   /api/admin/snippets                      # 创建碎片
GET    /api/admin/snippets/:id                  # 碎片详情
PUT    /api/admin/snippets/:id                  # 更新碎片
DELETE /api/admin/snippets/:id                  # 删除碎片
PUT    /api/admin/snippets/:id/status           # 修改状态

GET    /api/admin/tags
POST   /api/admin/tags
PUT    /api/admin/tags/:id
DELETE /api/admin/tags/:id

POST   /api/admin/media/upload                  # 上传文件（R2）
GET    /api/admin/media
DELETE /api/admin/media/:id

GET    /api/admin/stats                         # 统计（碎片数、标签数、近 7 天）
```

### 6.3 响应格式

```typescript
// packages/api-types/src/index.ts
export interface SnippetListItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  language: string | null;
  tags: { slug: string; name: string; color: string | null }[];
  publishedAt: string | null;
  createdAt: string;
}

export interface SnippetDetail extends SnippetListItem {
  contentMd: string; // Markdown 正文，前台直接渲染
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

## 七、前台页面与视觉风格

### 7.1 页面列表

| 页面       | 路由          | 说明                                                              |
| ---------- | ------------- | ----------------------------------------------------------------- |
| 首页       | `/`           | 碎片流（列表布局，按发布时间倒序）                                |
| 碎片详情   | `/post/$slug` | Markdown 渲染 + 标签徽标（TanStack Router 文件路由约定 `$` 前缀） |
| 标签云     | `/tags`       | 所有标签聚合 + 每个标签下最新 3 条                                |
| 搜索       | `/?q=keyword` | URL 参数触发搜索                                                  |
| 按标签筛选 | `/?tag=rust`  | URL 参数过滤列表                                                  |

### 7.2 UI 风格参考

```
┌─────────────────────────────────────────────────┐
│  murmur / 碎碎念              [🔍 搜索...]      │
│                              [标签云 →]         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ● 2026-07-18                                      │
│  Rust Vec::reserve 与内存分配行为                │
│  调用 reserve 时 Vec 会预先分配...                │
│  #Rust #Performance                              │
│  ── 阅读全文                                     │
│                                                 │
│  ● 2026-07-17                                      │
│  ZFS recordsize 与 compression 调优              │
│  ZFS 的 recordsize=1M...                         │
│  #ZFS #Storage                                   │
│  ── 阅读全文                                     │
│                                                 │
│  ← Prev        Page 3 / 12        Next →        │
├─────────────────────────────────────────────────┤
│  © Jonirrings · RSS · Powered by Murmur         │
└─────────────────────────────────────────────────┘
```

与 blog 的关键区别：

- **无侧边栏**、**无分类**、**无评论**
- 列表页每条显示标题 + 摘要 + 标签 + 日期
- 标签既是筛选器也是导航

---

## 八、Monorepo 结构

```
murmur/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── db/                        # Drizzle Schema + FTS5 migrations
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api-types/                 # 共享 API 类型
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── config/                    # Tailwind Token + 站点配置
│       ├── src/
│       │   ├── tailwind.ts
│       │   └── site.ts
│       └── package.json
│
├── apps/
│   ├── api/                       # murmur-api (Hono Worker)
│   ├── admin/                     # vinext (React)
│   └── portal/                     # TanStack Start (TanStack Router 文件路由)
│
├── .github/workflows/
│   ├── deploy-api.yml
│   ├── deploy-admin.yml
│   ├── deploy-portal.yml
│   └── run-migrations.yml
│
├── wrangler.toml
└── README.md
```

### 8.1 依赖图

```
packages/         apps/
  db ──────────→  api
  api-types ──→  api, admin, portal
  config ─────→  api, admin, portal
```

---

## 九、wrangler.toml

```toml
# apps/api/wrangler.toml
name = "murmur-api"
main = "src/index.ts"
compatibility_date = "2025-07-01"

workers_dev = false
routes = [
  { pattern = "m.o0x0o.com/api/*", zone_name = "<domain-name>" },
  { pattern = "m.o0x0o.com/auth/*", zone_name = "<domain-name>" },
  { pattern = "m.o0x0o.com/llms.txt", zone_name = "<domain-name>" },
  { pattern = "m.o0x0o.com/robots.txt", zone_name = "<domain-name>" },
  { pattern = "m.o0x0o.com/feed.xml", zone_name = "<domain-name>" },
  { pattern = "m.o0x0o.com/sitemap.xml", zone_name = "<domain-name>" },
]

[[d1_databases]]
binding = "DB"
database_name = "murmur-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "murmur-assets"
```

---

## 十、认证体系

与 blog 方案一致，只是独立部署在 murmur-db 中：

```
前台/后台 → /auth/* → murmur-api → D1 (murmur-db) → users / sessions / accounts
```

- **单用户模式**：个人站点，只有一个管理员帐号
- **GitHub OAuth** 作为主要登录方式
- **邮箱 + 密码**作为备选
- 前台阅读无需登录

---

## 十一、AI 友好性与搜索引擎优化

AI 爬虫（GPTBot、Claude-Web、PerplexityBot 等）和搜索引擎爬虫访问 murmur 时，核心需求是以最低成本发现和理解所有内容。所有端点由 murmur-api Worker 统一提供，无需额外服务。

### 11.1 `llms.txt` — AI 内容索引

```typescript
// apps/api/src/index.ts
// KV 缓存 1 小时
app.get("/llms.txt", async (c) => {
  const snippets = await c.env.DB.prepare(
    "SELECT slug, title, published_at FROM snippets WHERE status='published' ORDER BY published_at DESC",
  ).all();

  let content = "# murmur / m.o0x0o.com\n\n";
  content += `> Blog Title: Murmur — 碎碎念\n`;
  content += `> Description: Short technical notes and TILs\n`;
  content += `> Language: zh-CN\n\n`;
  content += `## Notes (append ?format=md for Markdown)\n\n`;

  for (const s of snippets.results) {
    content += `- https://m.o0x0o.com/api/public/snippets/${s.slug}?format=md: ${s.title} (${s.published_at})\n`;
  }

  return c.text(content, 200, { "Content-Type": "text/plain" });
});
```

AI 请求流程：

```
1. GET /llms.txt                    → 拿到所有碎片链接
2. GET /api/public/snippets/xxx?format=md → Markdown 原文
```

### 11.2 Content Negotiation — Markdown 原文

同一 API 端点根据 `?format` 参数或 `Accept` header 返回 Markdown 或 JSON：

```typescript
// apps/api/src/routes/public/snippets.ts
app.get("/api/public/snippets/:slug", async (c) => {
  const slug = c.req.param("slug");
  const accept = c.req.header("Accept") || "";
  const format = c.req.query("format")
    || (accept.includes("text/markdown") ? "md" : "json");

  const snippet = await c.env.DB.prepare(
    "SELECT * FROM snippets WHERE slug = ? AND status='published'"
  ).bind(slug).first();
  if (!snippet) return c.json({ error: "Not Found" }, 404);

  if (format === "md") {
    const md = [
      `---`,
      `title: "${snippet.title}"`,
      `published: ${snippet.publishedAt}`,
      `tags: [${/* 从关联表查 */}]`,
      `---`,
      ``,
      snippet.contentMd,
    ].join("\n");

    return c.text(md, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      // 明确授权 AI 使用
      "Content-Signal": "ai-train=yes, search=yes, ai-input=yes",
    });
  }

  // 碎片详情中的 JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: snippet.title,
    description: snippet.excerpt,
    datePublished: snippet.publishedAt,
    author: { "@type": "Person", name: "Jonirrings" },
  };

  return c.json({ ...snippet, jsonLd });
});
```

| `Accept` header            | 返回格式                     | 适用场景            |
| -------------------------- | ---------------------------- | ------------------- |
| `application/json`（默认） | JSON（含 `contentMd`）       | TanStack Query 前台 |
| `text/markdown`            | Markdown 原文 + front matter | AI 爬虫             |
| `?format=md` 显式指定      | 同上                         | 任何客户端          |

### 11.3 `robots.txt` — 欢迎 AI 爬虫

```typescript
app.get("/robots.txt", (c) => {
  return c.text(
    `User-agent: *\nAllow: /\n\n` +
      `User-agent: GPTBot\nAllow: /\n\n` +
      `User-agent: Claude-Web\nAllow: /\n\n` +
      `User-agent: PerplexityBot\nAllow: /\n\n` +
      `Sitemap: https://m.o0x0o.com/sitemap.xml`,
    200,
    { "Content-Type": "text/plain" },
  );
});
```

### 11.4 `sitemap.xml` — 搜索引擎索引

```typescript
app.get("/sitemap.xml", async (c) => {
  const snippets = await c.env.DB.prepare(
    "SELECT slug, updated_at FROM snippets WHERE status='published'",
  ).all();

  const urls = snippets.results
    .map(
      (s) => `
  <url>
    <loc>https://m.o0x0o.com/post/${s.slug}</loc>
    <lastmod>${s.updated_at}</lastmod>
  </url>`,
    )
    .join("");

  return c.text(
    `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    200,
    { "Content-Type": "application/xml" },
  );
});
```

### 11.5 `feed.xml` — RSS/Atom Feed

```typescript
app.get("/feed.xml", async (c) => {
  const snippets = await c.env.DB.prepare(
    "SELECT title, slug, excerpt, published_at FROM snippets WHERE status='published' ORDER BY published_at DESC LIMIT 20",
  ).all();

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Murmur — 碎碎念</title>
  <link href="https://m.o0x0o.com/feed.xml" rel="self"/>
  <link href="https://m.o0x0o.com/"/>
  <updated>${new Date().toISOString()}</updated>
  <author><name>Jonirrings</name></author>
  <id>https://m.o0x0o.com/</id>
  ${snippets.results
    .map(
      (s) => `
  <entry>
    <title>${escapeXml(s.title)}</title>
    <link href="https://m.o0x0o.com/post/${s.slug}"/>
    <id>https://m.o0x0o.com/post/${s.slug}</id>
    <published>${s.published_at}</published>
    <updated>${s.published_at}</updated>
    <summary>${escapeXml(s.excerpt || "")}</summary>
  </entry>`,
    )
    .join("")}
</feed>`;

  return c.text(feed, 200, { "Content-Type": "application/atom+xml; charset=utf-8" });
});
```

### 11.6 Content-Signal Header — 全局中间件

告知 AI 内容使用授权：

```typescript
app.use("*", async (c, next) => {
  await next();
  // 只给 200 响应添加，跳过 4xx/5xx
  if (c.res.status === 200) {
    c.res.headers.set("Content-Signal", "ai-train=yes, search=yes, ai-input=yes");
  }
});
```

### 11.7 前台 SEO

TanStack Router 的 `<head>` 管理通过 `meta` export 实现：

```tsx
// apps/portal/src/routes/post.$slug.tsx
import { createFileRoute } from "@tanstack/solid-router";
import { createQuery } from "@tanstack/solid-query";

export const Route = createFileRoute("/post/$slug")({
  component: PostPage,
  // SEO meta 标签
  head: ({ params }) => ({
    title: `Murmur — ${params.slug}`,
    meta: [
      { name: "description", content: "..." },
      { property: "og:title", content: "..." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "alternate", type: "application/atom+xml", href: "/feed.xml" }],
  }),
});
```

### 11.8 实施清单

| #   | 项目           | 路由                             | 优先级 | 工作量      |
| --- | -------------- | -------------------------------- | ------ | ----------- |
| 1   | `llms.txt`     | `GET /llms.txt`                  | P0     | ~15 行      |
| 2   | Markdown 协商  | `GET /api/public/snippets/:slug` | P0     | ~10 行      |
| 3   | JSON-LD        | 同上                             | P1     | ~5 行       |
| 4   | robots.txt     | `GET /robots.txt`                | P1     | ~10 行      |
| 5   | Content-Signal | 全局 middleware                  | P1     | 3 行        |
| 6   | RSS/Atom Feed  | `GET /feed.xml`                  | P1     | ~25 行      |
| 7   | Sitemap        | `GET /sitemap.xml`               | P0     | ~15 行      |
| 8   | 前台 SEO meta  | TanStack Router `head`           | P1     | ~15 行/页面 |

---

## 十二、费用测算

```
假设场景：日 PV 200，月发布 15 条，偶尔上传图片

服务        月消耗                 是否超出免费额度
──────      ─────────────          ─────────────────────
Workers     200 × 30 = 6000 请求     ❌ 远低于 10万/天
Pages       3 次部署                   ❌ 远低于 500/月
D1          6000 行读 + 30 行写       ❌ 远低于 500万读/月
R2          15 张图片 + 6000 次读     ❌ 远低于 1000万读/月

结论: 全部在免费额度内，月费 $0。
```

---

## 十三、路线图

### Phase 0：基础设施

- [ ] 创建 pnpm monorepo 结构（`murmur/`）
- [ ] 初始化 `packages/db`（Drizzle Schema + FTS5 DDL）
- [ ] 初始化 `packages/api-types`
- [ ] 初始化 `packages/config`
- [ ] 在 Cloudflare Dashboard 创建 D1 `murmur-db` + R2 `murmur-assets`
- [ ] POC：验证 D1 FTS5 可用性
- [ ] 配置 `m.o0x0o.com` 域名绑定

### Phase 1：API Worker

- [ ] 脚手架 murmur-api (Hono + Cloudflare Workers)
- [ ] D1 绑定 + drizzle-orm 集成
- [ ] better-auth 集成（drizzleAdapter）→ `/auth/*` 路由
- [ ] 实现公开 API（snippets CRUD、tags、FTS5 search）
- [ ] 实现管理 API（认证中间件）
- [ ] 图片/附件上传（R2）
- [ ] 统一错误处理 + Zod 输入校验
- [ ] 编写 `deploy-api.yml`

### Phase 2：Admin 后台

- [ ] 脚手架 admin 站点 (vinext)
- [ ] 登录页（调用 better-auth）
- [ ] 仪表盘（碎片数、标签数、近 7 天趋势）
- [ ] CodeMirror 6 Markdown 编辑器 + 实时预览
- [ ] 碎片管理（CRUD + 状态切换 + 标签选择器）
- [ ] 标签管理（CRUD + 色值选择）
- [ ] 媒体管理（图片上传、R2 存储）
- [ ] 编写 `deploy-admin.yml`

### Phase 3：Portal 前台

- [ ] 脚手架 portal 站点（TanStack Start + TanStack Router 文件路由）
- [ ] TanStack Router + TanStack Solid Query 集成 → murmur-api
- [ ] 定义文件路由（`routes/index.tsx`、`routes/post.$slug.tsx`、`routes/tags.tsx`）
- [ ] 首页碎片流（倒序时间线 + 分页）
- [ ] 详情页（Markdown 渲染 + shiki 高亮）
- [ ] 标签云页（标签聚合 + 每个标签最新 3 条）
- [ ] URL 参数搜索 + 标签筛选（`useNavigate` + `useSearch`）
- [ ] 响应式布局 + 暗色模式
- [ ] 编写 `deploy-portal.yml`

### Phase 4：AI 友好性与发布

- [ ] `llms.txt` 动态生成（所有公开碎片索引）
- [ ] Markdown 原文内容协商（`?format=md` + `Accept: text/markdown`）
- [ ] JSON-LD 结构化数据（文章详情 API 返回 `Schema.org/TechArticle`）
- [ ] `Content-Signal` 全局 middleware
- [ ] `robots.txt`（允许所有 AI 爬虫）
- [ ] `feed.xml`（Atom Feed，最新 20 条）
- [ ] `sitemap.xml`（搜索引擎索引）
- [ ] 前台 SEO meta（TanStack Router `head` export：`title` / `og:*` / `twitter:card`）
- [ ] 撰写 README
- [ ] 正式上线

---

## 十四、与 Blog 项目的关系

murmur 是一个**完全独立**的项目：

| 方面     | Blog                  | Murmur                |
| -------- | --------------------- | --------------------- |
| 目录     | `blog/`               | `murmur/`             |
| 域名     | `blog.jonirrings.com` | `m.o0x0o.com`         |
| D1       | `blog-db`             | `murmur-db`           |
| R2       | `blog-assets`         | `murmur-assets`       |
| Worker   | `blog-api`            | `murmur-api`          |
| Pages    | 5 个项目              | 2 个项目              |
| Monorepo | blog 内的 workspace   | murmur 内的 workspace |

两者无共享基础设施，各自独立部署和计费。如果有重复的工具代码（如 drizzle 配置、better-auth 配置模板），可以抽到单独的 `packages/` 公共包，但 murmur 本身不依赖 blog 的任何运行时资源。
