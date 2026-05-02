# Murmur 实施计划

> 基于 spec.md 的分阶段实施计划，每阶段产出可部署的增量。

---

## Phase 1：项目骨架与认证（Week 1-2）

### 目标

项目可运行，能注册/登录，OOBE 流程跑通。

### 任务

- [x] **1.1 项目初始化**
  - `pnpm create cloudflare@latest murmur -- --template hono`
  - 配置 Vite（客户端 SPA 构建）、TypeScript、OxLint + OxFmt（via vite-plus）
  - 配置 Tailwind CSS v4（未使用 shadcn/ui，改为纯 Tailwind 手写组件）
  - 配置 Drizzle ORM + `drizzle.config.ts`
  - 配置 `wrangler.toml`（D1、KV、R2、DO、Assets 绑定）
  - 配置 Workers Assets（`[assets]` + `ASSETS` 绑定 + SPA 模式 + `run_worker_first`）

- [x] **1.2 D1 Schema 与迁移**
  - 编写 `src/db/schema.ts`（Drizzle Schema 定义）
  - `drizzle-kit generate` 生成初始迁移
  - `wrangler d1 migrations apply --local` 本地验证
  - 添加 better-auth admin 插件所需字段（`banned`, `banReason`, `banExpires` on user; `impersonatedBy` on session）

- [x] **1.3 better-auth 集成**
  - 配置 better-auth + D1 adapter + Magic Link plugin + admin plugin
  - 扩展 `users` 表：`role`、`approval_status`、`banned`、`banReason`、`banExpires` 字段
  - 扩展 `session` 表：`impersonatedBy` 字段
  - 实现 `src/auth/better-auth.config.ts`
  - 实现 `src/auth/middleware.ts`（Session 校验）
  - `AuthEnv` 类型添加 `ASSETS: Fetcher`

- [x] **1.4 RBAC 中间件**
  - 实现 `src/auth/rbac.ts`（requireRole / requireAdmin / requireAuthor / requireAuth）
  - 实现 `src/auth/turnstile.ts`（注册/登录人机验证）

- [x] **1.5 OOBE 初始化**
  - 实现 `GET /api/setup/status`、`POST /api/setup/admin`
  - 实现 `/setup` 前端页面（React Hook Form + Zod）
  - 中间件拦截：有 admin 后 `/setup` 302 到 `/login`

- [x] **1.6 登录页面**
  - `/login` SPA 路由（TanStack Router）
  - WebAuthn Passkey 登录（@better-auth/passkey 插件）
  - Email Magic Link 登录（Resend API 发送）
  - TOTP 2FA 验证流程（better-auth twoFactor 插件）
  - Turnstile Widget 集成

- [x] **1.7 基础布局**
  - AppShell 组件（侧边栏 + 顶栏）
  - Zustand stores：`ui-store.ts`（含 theme, sidebarOpen, locale）
  - TanStack Query provider 配置
  - TanStack Router 文件路由（`src/client/routes/`）
  - i18n 集成（i18next + react-i18next + 命名空间）
  - SSR 重构为 hono/jsx 组件（`src/components/ssr/` + `src/routes/ssr.tsx`）

### 交付物

- 可部署的 Worker
- OOBE → 创建管理员 → Magic Link 登录 → 进入后台
- RBAC 中间件拦截非授权访问
- TanStack Router 文件路由 + i18n 双语支持
- hono/jsx SSR 组件化渲染
- Workers Assets SPA 服务

---

## Phase 2：笔记 CRUD 与编辑器（Week 3-4）

### 目标

作者可以创建、编辑、发布笔记，公开页面 SSR 可访问。

### 任务

- [x] **2.1 笔记 CRUD API**
  - `src/db/repositories/note.repo.ts`（Drizzle 查询）
  - `src/services/note.service.ts`
  - `src/routes/api/notes.ts`（CRUD + publish/unpublish）
  - Zod Schema：`src/shared/schemas/note.ts`
  - TanStack Query：`src/client/queries/notes.ts`

- [x] **2.2 标签系统**
  - `src/db/repositories/tag.repo.ts`
  - `src/services/tag.service.ts`
  - `src/routes/api/tags.ts`（仅 admin 可创建/删除）

- [x] **2.3 CodeMirror 6 编辑器**
  - `src/client/components/editor/MarkdownEditor.tsx`
  - CommonMark + GFM 支持
  - 快捷键（加粗、斜体、代码块、链接、保存）
  - 图片上传 → R2
  - 自动保存（`useAutoSave` hook，3 秒防抖）

- [x] **2.4 Markdown 渲染管线**
  - `src/services/render.service.ts`（remark-parse + remark-gfm + rehype-sanitize + rehype-stringify）
  - SSR 渲染为完整 HTML

- [x] **2.5 公开 SSR 页面**
  - `src/routes/ssr.tsx`：首页 `/`、笔记详情 `/note/:slug`、标签页 `/tag/:tag`、分类页 `/category/:category`、预览 `/preview/:token`
  - hono/jsx 组件渲染（`src/components/ssr/`）
  - KV 缓存 + 失效策略（locale 后缀 key）
  - OG 标签、meta 标签
  - SSR i18n 支持（`detectLocale` + `t()`）

- [x] **2.6 管理后台 SPA**
  - 笔记列表页（分页、筛选）
  - 编辑器页（创建/编辑）
  - 发布/取消发布
  - TanStack Router 文件路由替代 react-router-dom

- [x] **2.7 附件上传**
  - `src/routes/api/attachments.ts`（POST 上传 → R2，GET 代理下载）
  - 拖拽/粘贴图片上传

### 交付物

- 作者可创建/编辑/发布笔记
- 公开页面 SSR 可访问，KV 缓存生效
- 编辑器可用，图片可上传

---

## Phase 3：评论系统与用户管理（Week 5-6）

### 目标

双层评论审核跑通，管理员可管理用户和评论。

### 任务

- [x] **3.1 评论 CRUD**
  - `src/db/repositories/comment.repo.ts`
  - `src/services/comment.service.ts`（双层审核逻辑）
  - `src/routes/api/comments.ts`
  - Zod Schema：`src/shared/schemas/comment.ts`
  - TanStack Query：`src/client/queries/comments.ts`

- [x] **3.2 评论前端组件**
  - `CommentForm.tsx`（React Hook Form + Zod 校验）
  - `CommentList.tsx`（分页加载）
  - `CommentItem.tsx`（审核状态标记）
  - `CommentReview.tsx`（作者审核：通过/拒绝）

- [x] **3.3 用户审批**
  - `PATCH /api/admin/users/:id/approval`
  - `GET /api/admin/users/pending`
  - 管理后台用户管理页面：审批/拒绝/角色变更

- [x] **3.4 管理员后台**
  - 用户列表 + 审批操作
  - 评论管理（隐藏/显示）
  - 站点设置（KV 存储）

- [x] **3.5 Rate Limiter DO**
  - `src/do/rate-limiter.do.ts`
  - 评论限流：1 条/分钟/用户/笔记，20 条/小时
  - 登录限流：10 次/分钟/IP

### 交付物

- 评论双层审核完整流程
- 管理员后台可用
- 限流生效

---

## Phase 4：协作编辑与实时预览（Week 7-9）

### 目标

多人可同时编辑同一笔记，预览链接可实时查看。

### 任务

- [x] **4.1 Yjs 集成**
  - 安装 `yjs`、`y-websocket`、`y-codemirror.next`
  - `src/client/hooks/useCollabEditor.ts`：Yjs Doc 创建 + WebSocket 连接 + yCollab 扩展
  - `y-codemirror.next` 绑定 CodeMirror 6

- [x] **4.2 CollaborationRoomDO**
  - `src/do/collaboration-room.do.ts`
  - Yjs 文档状态管理（Hibernation API）
  - y-websocket 协议实现（sync step 1/2, update 消息）
  - 权限校验（editor vs viewer，viewer 编辑操作被丢弃）
  - 持久化：Yjs 状态 → Markdown → D1

- [x] **4.3 协作者 UI**
  - `CollabPresence.tsx`：在线用户列表 + 光标颜色
  - WebSocket 连接状态指示器（编辑器页 ●/○ 标识）

- [x] **4.4 WebRTC P2P 升级**
  - `y-webrtc` 集成 + 自动切换逻辑
  - 2+ 人时自动尝试 P2P（`useCollabEditor` 中 awareness 监听）
  - 连接失败自动回退 WebSocket
  - CollaborationRoomDO 新增 signaling 消息处理（subscribe/unsubscribe/publish/ping）
  - Awareness 消息中继（MSG_AWARENESS=1 广播）

- [x] **4.5 只读预览**
  - `GET /api/collab/ws/view?noteId=` — viewer 角色 WebSocket 端点（无需认证）
  - viewer 角色加入 CollaborationRoomDO
  - 预览页面（SSR `/preview/:token`）

- [x] **4.6 协作会话管理**
  - `src/db/repositories/collab-session.repo.ts` — CRUD + 过期清理
  - `collabSessions` 表新增 `creatorId`、`role` 字段
  - `GET /api/collab/rooms/:noteId/sessions` — 列出活跃会话
  - `DELETE /api/collab/rooms/:noteId/sessions/:sessionId` — 停用会话
  - `POST /api/collab/cleanup` — 管理员清理过期会话
  - 预览 token 生成

### 交付物

- 多人协作编辑可用
- 光标同步、离线合并
- 只读预览链接可用

---

## Phase 5：打磨与上线（Week 10-11）

### 目标

搜索、SEO、暗色模式、移动端适配、性能优化、部署。

### 任务

- [x] **5.1 搜索功能**
  - D1 `LIKE` 查询 + 前端防抖
  - `GET /api/search`

- [x] **5.2 SEO 优化**
  - meta 标签、OG 标签
  - sitemap.xml 生成
  - robots.txt

- [x] **5.3 暗色模式**
  - Tailwind `dark:` 变体
  - `class` 策略切换
  - Zustand `ui-store` 持久化偏好

- [x] **5.4 移动端适配**
  - 编辑器移动端优化（`100dvh`、工具栏横向滚动、浮动保存按钮）
  - 管理后台列表页移动端适配（flex-wrap 筛选栏）
  - SSR 页面 `<meta name="theme-color">`

- [x] **5.5 性能优化**
  - 图片懒加载（rehype 插件注入 `loading="lazy"` + `decoding="async"`）
  - Vite 代码分割（manualChunks: react, tanstack, codemirror, i18n）

- [x] **5.6 测试**
  - Vitest 单元测试（Service 层：note, comment, tag, setup, cache, render, search）
  - 服务端 i18n 测试（`shared/i18n/__tests__/server.test.ts`）
  - Miniflare 集成测试（API 路由、RBAC）
  - Playwright E2E 测试（登录、笔记 CRUD、评论审核）

- [x] **5.7 CI/CD**
  - GitHub Actions：lint + typecheck + test + build + build:worker
  - `wrangler deploy` 自动部署（main 分支合并后）

- [ ] **5.8 自定义域名**
  - Cloudflare Custom Domain 配置
  - WebAuthn RP_ID 已更新为 `mm.o0x0o.com`

- [x] **5.9 Passkey 认证**
  - `@better-auth/passkey` 插件集成（服务端 + 客户端）
  - 登录页 Passkey 登录按钮
  - Setup 页 Passkey 注册
  - `passkey` 表 Schema + 迁移

- [x] **5.10 TOTP 2FA**
  - `better-auth/plugins/two-factor` 插件集成
  - `/admin/security` 安全管理页面（TOTP 启用/禁用/验证 + 备份码）
  - 登录 2FA 验证流程
  - Passkey 列表管理
  - `two_factor` 表 Schema + 迁移

- [x] **5.11 自动保存 Hook**
  - `src/client/hooks/useAutoSave.ts` 提取为独立 Hook
  - 编辑器使用 `useAutoSave` 替代内联 setTimeout 逻辑

- [x] **5.12 分类 SSR 页面**
  - `GET /category/:category` 路由 + `CategoryPage` 组件
  - KV 缓存 + 失效策略（含分类页）
  - SSR i18n 分类名称
  - Sitemap 包含分类页 URL

- [x] **5.13 实时访客计数器**
  - `src/do/visitor-counter.do.ts` — VisitorCounterDO（Hibernation API，全局单实例，per-pageKey 追踪）
  - `src/routes/api/visitor-counter.ts` — WebSocket 升级 + HTTP 计数端点
  - `src/components/ssr/visitor-counter-script.tsx` — 内联 WebSocket 脚本（自动重连 + 退避）
  - `src/client/queries/visitor-counter.ts` — `useSiteWideOnlineCount` hook（30s 轮询）
  - SSR 页面显示"N 人正在阅读"（`showReaderCount` prop）
  - 管理后台仪表盘显示"在线访客"统计卡
  - wrangler.toml 新增 `VISITOR_COUNTER_DO` 绑定 + v2 迁移

- [x] **5.14 笔记阅读量统计**
  - `src/services/view-tracker.service.ts` — ViewTrackerService（反爬虫 + CF Analytics 校准）
  - `src/routes/api/view-stats.ts` — 管理员端点：POST /sync（CF Analytics 校准）、GET /（查看计数）
  - notes 表新增 `view_count` 字段（migration 0001）
  - SSR 笔记详情页显示"· N 阅读"
  - `c.executionCtx.waitUntil` 非阻塞计数递增
  - Cloudflare Bot Management 评分过滤（cf-bot-management-score < 30）

- [x] **5.15 评论长度限制调整**
  - 评论内容最大长度从 2000 字符缩减为 200 字符
  - `src/shared/schemas/comment.ts` + `CommentForm.tsx` 同步更新

### 交付物

- 生产就绪的完整应用
- CI/CD 流水线
- E2E 测试覆盖核心流程

---

## 依赖关系

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
  │                    │           │
  └─ 认证/DB ──────────┘           │
                      └─ 评论/用户 ─┘
                                   └─ 协作编辑
```

- Phase 1 是所有后续阶段的基础
- Phase 2、3 相对独立，但 3 依赖 2 的笔记发布（评论挂在笔记下）
- Phase 4 依赖 2 的编辑器基础设施
- Phase 5 依赖所有前置阶段完成
