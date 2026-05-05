# Murmur Agent 指南

> AI Agent（Claude Code）在实现 Murmur 项目时必须遵守的规范和约定。

---

## 1. 项目概览

Murmur 是部署在 Cloudflare Workers 上的笔记系统，支持双层评论审核、Magic Link 认证。

**技术栈**：Hono v4 + React 19 + Vite 8 + Tailwind CSS v4 + Drizzle ORM + better-auth (magic link + passkey + 2FA) + D1 + KV + R2 + Durable Objects + TanStack Router + i18next + lucide-react

**详细规格**：参见 `spec.md`
**实施计划**：参见 `plan.md`

---

## 2. 文件约定

### 2.1 目录结构

```
src/
├── index.ts              # Hono 入口
├── app.ts                # Hono app 实例（含 ASSETS SPA/静态资源服务）
├── routes/               # 路由（每个文件一个路由组）
│   ├── ssr.tsx           # 公开 SSR 页面（hono/jsx 组件渲染）
│   └── api/              # API 路由
├── components/
│   └── ssr/              # hono/jsx SSR 组件
│       ├── layout.tsx    # HtmlDocument 外壳 + 导航 + 页脚 + Cookie 横幅
│       ├── note-card.tsx # 笔记卡片
│       ├── note-detail.tsx # 笔记详情 + 列表/标签/预览/错误页
│       ├── comment-item.tsx # 评论项
│       ├── pagination.tsx # 分页
│       ├── privacy-page.tsx # 隐私政策 SSR 页面
│       ├── about-page.tsx  # 关于 SSR 页面
│       └── visitor-counter-script.tsx # WebSocket 实时访客脚本
├── services/             # 业务逻辑（不直接操作 DB）
│   ├── view-tracker.service.ts # 阅读量统计（反爬虫 + CF Analytics 校准）
│   └── ...                    # note, comment, tag, setup, search, cache, render
├── db/                   # Drizzle ORM 层
│   ├── schema.ts         # Schema 定义（Single Source of Truth）
│   ├── client.ts         # Drizzle + D1 初始化
│   └── repositories/     # 数据访问层
├── do/                   # Durable Objects
│   ├── collaboration-room.do.ts  # Yjs 协作（Hibernation API）
│   ├── rate-limiter.do.ts        # IP 限流
│   └── visitor-counter.do.ts     # WebSocket 实时访客计数
│   ├── collaboration-room.do.ts  # Yjs real-time collaboration + WebRTC signaling (Hibernation API)
│   ├── rate-limiter.do.ts        # IP-based rate limiting
│   └── visitor-counter.do.ts     # WebSocket real-time visitor counting
├── auth/                 # 认证配置 + RBAC
├── client/               # 客户端 SPA（TanStack Router）
│   ├── main.tsx          # React 入口（createRouter + RouterProvider）
│   ├── app.tsx           # LocaleSync 组件
│   ├── routeTree.gen.ts  # 自动生成路由树
│   ├── routes/           # TanStack Router 文件路由
│   │   ├── __root.tsx    # 根布局（QueryClientProvider + ThemeProvider + LocaleSync）
│   │   ├── setup.tsx
│   │   ├── login.tsx
│   │   ├── admin.tsx     # Admin 布局（侧边栏 + 认证守卫）
│   │   ├── admin/dashboard.tsx
│   │   ├── admin/notes.tsx
│   │   ├── admin/notes/new.tsx
│   │   ├── admin/notes/$id.edit.tsx
│   │   ├── admin/users.tsx
│   │   ├── admin/comments.tsx
│   │   ├── admin/settings.tsx
│   │   └── admin/security.tsx
│   ├── i18n/             # i18next 配置
│   │   ├── index.ts      # i18next.init()
│   │   └── locales/      # 按语言/命名空间组织
│   │       ├── zh-CN/    # common, admin, auth, editor, comments
│   │       ├── en/       # common, admin, auth, editor, comments
│   │       └── ja/       # common, admin, auth, editor, comments
│   ├── pages/            # 页面组件（被 routes/ 引用）
│   ├── components/       # 通用组件
│   │   ├── cookie-consent.tsx # Cookie 同意横幅（SPA）
│   │   ├── theme-toggle.tsx
│   │   ├── theme-provider.tsx
│   │   └── (no ui/ dir)  # 未使用 shadcn/ui，纯 Tailwind 手写
│   ├── stores/           # Zustand 状态（含 locale, cookieConsent）
│   ├── queries/          # TanStack Query
│   ├── schemas/          # Zod Schema
│   ├── hooks/            # 自定义 Hooks (useAutoSave)
│   └── lib/              # 工具函数
└── shared/               # 前后端共享
    ├── types.ts
    ├── constants.ts
    ├── rbac.ts
    ├── i18n/             # 服务端 i18n
    │   ├── server.ts     # detectLocale() + t()
    │   └── locales/      # zh-CN.json, en.json（SSR 专用）
    └── schemas/          # Zod Schema（前后端共享）
```

### 2.2 命名约定

| 类型                | 约定                    | 示例                                           |
| ------------------- | ----------------------- | ---------------------------------------------- |
| 文件名              | kebab-case              | `note.service.ts`, `comment.repo.ts`           |
| React 组件          | PascalCase              | `MarkdownEditor.tsx`, `CommentList.tsx`        |
| Zod Schema          | camelCase + Schema 后缀 | `createCommentSchema`                          |
| TanStack Query hook | use + 动词 + 名词       | `useCreateNote`, `useNotes`                    |
| Zustand store       | kebab-case + -store     | `ui-store.ts`（含 theme, sidebarOpen, locale） |
| Drizzle table       | camelCase（与 JS 一致） | `notes`, `noteTags`, `collabSessions`          |
| API 路由            | kebab-case              | `/api/collab/rooms/:noteId`                    |
| 环境变量            | UPPER_SNAKE_CASE        | `RP_ID`, `TURNSTILE_SECRET_KEY`                |

### 2.3 导入顺序

```typescript
// 1. 外部依赖
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";

// 2. 内部模块（使用 @/ 别名）
import { notes, comments } from "@/db/schema";
import { requireAuth } from "@/auth/middleware";

// 3. 类型
import type { Database } from "@/db/client";
```

---

## 3. 编码规范

### 3.1 类型安全

- **禁止 `any`**：必须定义明确类型，Drizzle 自动推导的返回类型优先
- **Zod Schema 即类型**：`z.infer<typeof xxxSchema>` 派生类型，不重复定义
- **共享 Schema**：API 输入校验 Schema 放 `src/shared/schemas/`，前后端共用
- **Drizzle 返回类型**：用 `typeof table.$inferSelect` / `typeof table.$inferInsert`，不手写

### 3.2 API 路由

```typescript
// 标准路由模板
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createCommentSchema } from "@/shared/schemas/comment";
import { requireAuth } from "@/auth/middleware";
import { CommentService } from "@/services/comment.service";

const app = new Hono();

app.post("/:noteId/comments", requireAuth, zValidator("json", createCommentSchema), async (c) => {
  const { noteId } = c.req.param();
  const input = c.req.valid("json");
  const user = c.get("user");
  const db = c.get("db");
  const service = new CommentService(db);
  const comment = await service.create(noteId, user.id, input.content);
  return c.json({ data: comment }, 201);
});
```

### 3.3 错误处理

```typescript
// 统一错误格式
interface ApiError {
  error: {
    code: string; // VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED
    message: string; // 人类可读
    details?: unknown; // Zod 校验详情
  };
}

// Hono 全局错误处理
app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "请求校验失败", details: err.issues } },
      400,
    );
  }
  if (err instanceof AuthError) {
    return c.json({ error: { code: "UNAUTHORIZED", message: err.message } }, 401);
  }
  // ...
  return c.json({ error: { code: "INTERNAL_ERROR", message: "服务内部错误" } }, 500);
});
```

### 3.4 数据库操作

- **所有 DB 操作通过 Repository 层**：Service 不直接写 Drizzle 查询，调用 `repo.method()`
- **Drizzle 优先**：不写原始 SQL，除非 Drizzle 不支持（如 `PRAGMA`）
- **事务**：涉及多表写操作时使用 `db.transaction()`
- **迁移**：修改 `src/db/schema.ts` 后运行 `pnpm drizzle-kit generate`，不手写 SQL

### 3.5 React 组件

- **函数式组件 + Hooks**：禁止 class 组件
- **Tailwind 手写组件**：Phase 1-3 未引入 shadcn/ui，使用纯 Tailwind 工具类构建 UI；后续可按需引入
- **Tailwind 类名**：用 `cn()` 工具函数合并条件类名（`clsx` + `tailwind-merge`）
- **禁止内联样式**：核心样式必须用 Tailwind 类或 CSS Modules
- **状态管理边界**：
  - 服务端状态 → TanStack Query（`useQuery`, `useMutation`）
  - 客户端 UI 状态 → Zustand
  - 表单状态 → React Hook Form
  - 不用 `useState` 管可从 API 获取的数据

### 3.6 Zod Schema 前后端共享

```typescript
// src/shared/schemas/comment.ts
import { z } from "zod";

export const createCommentSchema = z.object({
  content: z.string().min(1).max(200),
  noteId: z.string(),
});

// 前端使用
import { zodResolver } from "@hookform/resolvers/zod";
import { createCommentSchema } from "@/shared/schemas/comment";
const form = useForm({ resolver: zodResolver(createCommentSchema) });

// 后端使用
import { zValidator } from "@hono/zod-validator";
import { createCommentSchema } from "@/shared/schemas/comment";
app.post("/", zValidator("json", createCommentSchema), handler);
```

### 3.7 i18n 约定

- **客户端**：`i18next` + `react-i18next`，5 个命名空间（common, admin, auth, editor, comments），支持 zh-CN / en / ja 三语
- **服务端**：`src/shared/i18n/server.ts` 的 `detectLocale()` + `t()` 函数，用于 hono/jsx SSR 组件
- **语言切换**：`useUiStore().setLocale()` 同时更新 Zustand 状态和 `i18next.changeLanguage()`，管理后台使用下拉选择器切换
- **Locale 持久化**：通过 Zustand persist 中间件存入 localStorage
- **SSR locale 检测**：从 `Accept-Language` header 检测，默认 `en`
- **API 错误消息**：不做 i18n，客户端根据 error code 映射到本地化字符串
- **禁止多 Key 拼接**：每个 i18n Key 必须语义完整，含插值参数

### 3.8 TanStack Router 约定

- **文件路由**：`src/client/routes/` 目录，`tanstackRouter()` Vite 插件自动生成 `routeTree.gen.ts`
- **导航 API**：`navigate({ to: "path" })` 对象语法，非字符串语法
- **路由参数**：`useParams({ strict: false })` 自动推断类型，不传泛型
- **活跃链接**：`<Link>` 使用 `activeProps` 替代 `<NavLink>`
- **类型注册**：`declare module "@tanstack/react-router" { interface Register { router: typeof router } }`

---

## 4. 架构约束

### 4.1 SSR 与 SPA 边界

- **公开页面**（`/`、`/note/:slug`、`/tag/:tag`、`/category/:category`、`/hot`、`/privacy`、`/about`）：Hono SSR 渲染（hono/jsx 组件），客户端仅轻量交互
- **管理后台**（`/admin/*`、`/login`、`/setup`、`/privacy`、`/about`）：Vite 构建的 React SPA（TanStack Router），Worker 通过 `ASSETS` 绑定返回 `index.html`
- **Hono 路由分流**：`/api/*` → API，`/admin/*` + `/setup` + `/login` → ASSETS SPA fallback，`/assets/*` → ASSETS 静态资源，其余 → SSR
- **Workers Assets 配置**：`wrangler.toml` 中 `[assets]` 设置 `run_worker_first = true`，`not_found_handling = "single-page-application"`，`binding = "ASSETS"`
- **SSR locale 支持**：`detectLocale(acceptLanguage)` 检测语言，KV 缓存 key 附加 locale 后缀（如 `ssr:/zh-CN`）

### 4.2 Durable Objects 约束

- 每个 DO 实例有 128MB 内存限制，单笔记 Yjs 文档不得超过 1MB
- DO 空闲 30 秒后应持久化状态并释放内存
- DO 不直接访问 D1，通过 `this.env.DB` 绑定访问
- WebSocket 消息必须校验来源角色，viewer 的编辑操作直接丢弃

### 4.3 RBAC 执行

- **每次请求校验**：RBAC 中间件从 Session 读取 `role`，不信任客户端传入
- **路由级守卫**：`requireAdmin`、`requireAuthor`、`requireAuth` 挂在路由定义上
- **业务级校验**：笔记编辑/删除需额外校验 `author_id === userId`

### 4.4 评论可见性规则

查询评论时必须按以下规则过滤，不可遗漏：

```
用户未登录 → 仅返回 author_approved=1 AND admin_hidden=0 AND user.approval_status='approved'
用户已登录 → 上述 + 自己的评论（author_id=me AND admin_hidden=0）
笔记作者   → 上述 + 自己笔记下 approval_status='approved' 用户的待审核评论
管理员     → 所有评论（含已隐藏，标记 admin_hidden）
```

---

## 5. 安全清单

每次修改代码时检查：

- [ ] API 输入是否通过 Zod 校验
- [ ] RBAC 中间件是否挂在需要保护的路由上
- [ ] 评论查询是否按可见性规则过滤
- [ ] 协作房间是否校验连接角色
- [ ] 文件上传是否校验 MIME 类型和大小
- [ ] SQL 注入是否被 Drizzle 参数化查询阻止
- [ ] XSS 是否被 React 自动转义 + SSR HTML sanitize 阻止
- [ ] Turnstile token 是否在注册/登录时验证
- [ ] Passkey 凭证是否通过 better-auth passkey 插件管理
- [ ] TOTP 2FA 是否通过 better-auth twoFactor 插件启用/验证
- [ ] 安全页面（/admin/security）是否限制已登录用户访问

---

## 6. 测试约定

### 6.1 测试文件位置

```
src/
├── services/__tests__/
│   ├── note.service.test.ts
│   ├── comment.service.test.ts
│   ├── tag.service.test.ts
│   ├── setup.service.test.ts
│   ├── cache.service.test.ts
│   ├── render.service.test.ts
│   ├── search.service.test.ts
│   └── view-tracker.service.test.ts
├── shared/i18n/__tests__/server.test.ts
├── db/repositories/__tests__/note.repo.test.ts
├── routes/api/__tests__/notes.test.ts
├── shared/schemas/__tests__/comment.test.ts
└── client/
    └── components/__tests__/CommentForm.test.tsx
```

### 6.2 测试工具

- **单元测试**：Vitest + `vi.mock()` 模拟 Repository 层
- **API 测试**：`app.request()` + Vitest 断言
- **组件测试**：Vitest + React Testing Library
- **E2E 测试**：Playwright + Miniflare
- **Mock 模式**：`vi.mock("@/db/repositories/xxx.repo", () => ({ XxxRepo: function(_db?: any) { return mockXxxRepo; } }))`（使用 function 而非箭头函数，因为 `new XxxRepo()` 需要）

### 6.3 关键测试场景

- OOBE 并发创建 admin（竞争条件）
- 评论双层审核可见性（6 种角色组合）
- RBAC 中间件拦截（未登录 / 角色不足 / 角色正确）
- Yjs 协作编辑冲突合并
- 预览 token 过期后拒绝访问
- 限流 DO 触发 429

---

## 7. Git 约定

### 7.1 分支策略

```
main          ← 生产分支，自动部署
├── dev       ← 开发分支
├── feat/xxx  ← 功能分支
├── fix/xxx   ← 修复分支
└── chore/xxx ← 杂项分支
```

### 7.2 Commit 格式

```
type(scope): description

feat(editor): add Yjs collaboration binding
fix(auth): prevent concurrent OOBE admin creation
refactor(db): migrate from raw SQL to Drizzle ORM
test(comments): add dual-review visibility tests
chore(deps): update hono to v4.6
```

### 7.3 PR 要求

- 类型检查通过：`tsc --noEmit`
- Lint 通过：`vp lint src/`
- 格式化通过：`vp fmt src/ --check`
- 单元测试通过：`vitest run`
- Drizzle 迁移已生成：`drizzle-kit generate`（如有 schema 变更）
