# Murmur 实施计划

> 基于 spec.md 的分阶段实施计划，每阶段产出可部署的增量。

---

## Phase 1：项目骨架与认证（Week 1-2）

### 目标
项目可运行，能注册/登录，OOBE 流程跑通。

### 任务

- [ ] **1.1 项目初始化**
  - `pnpm create cloudflare@latest murmur -- --template hono`
  - 配置 Vite（客户端 SPA 构建）、TypeScript、ESLint、Prettier
  - 配置 Tailwind CSS v4 + shadcn/ui（`pnpm dlx shadcn@latest init`）
  - 配置 Drizzle ORM + `drizzle.config.ts`
  - 配置 `wrangler.toml`（D1、KV、R2、DO 绑定）

- [ ] **1.2 D1 Schema 与迁移**
  - 编写 `src/db/schema.ts`（Drizzle Schema 定义）
  - `drizzle-kit generate` 生成初始迁移
  - `wrangler d1 migrations apply --local` 本地验证

- [ ] **1.3 better-auth 集成**
  - 配置 better-auth + D1 adapter + Passkey plugin
  - 扩展 `users` 表：`role`、`approval_status` 字段
  - 实现 `src/auth/better-auth.config.ts`
  - 实现 `src/auth/middleware.ts`（Session 校验）

- [ ] **1.4 RBAC 中间件**
  - 实现 `src/auth/rbac.ts`（requireRole / requireAdmin / requireAuthor / requireAuth）
  - 实现 `src/auth/turnstile.ts`（注册/登录人机验证）

- [ ] **1.5 OOBE 初始化**
  - 实现 `GET /api/setup/status`、`POST /api/setup/admin`
  - 实现 `/setup` 前端页面（shadcn/ui 表单 + React Hook Form + Zod）
  - 中间件拦截：有 admin 后 `/setup` 302 到 `/login`

- [ ] **1.6 登录页面**
  - `/login` SPA 路由
  - WebAuthn Passkey 登录（better-auth 内置）
  - Email Magic Link 登录（Resend API 发送）
  - Turnstile Widget 集成

- [ ] **1.7 基础布局**
  - AppShell 组件（侧边栏 + 顶栏）
  - Zustand stores：`ui-store.ts`
  - TanStack Query provider 配置

### 交付物
- 可部署的 Worker
- OOBE → 创建管理员 → Passkey 登录 → 进入后台（空白页）
- RBAC 中间件拦截非授权访问

---

## Phase 2：笔记 CRUD 与编辑器（Week 3-4）

### 目标
作者可以创建、编辑、发布笔记，公开页面 SSR 可访问。

### 任务

- [ ] **2.1 笔记 CRUD API**
  - `src/db/repositories/note.repo.ts`（Drizzle 查询）
  - `src/services/note.service.ts`
  - `src/routes/api/notes.ts`（CRUD + publish/unpublish）
  - Zod Schema：`src/shared/schemas/note.ts`
  - TanStack Query：`src/client/queries/notes.ts`

- [ ] **2.2 标签系统**
  - `src/db/repositories/tag.repo.ts`
  - `src/services/tag.service.ts`
  - `src/routes/api/tags.ts`（仅 admin 可创建/删除）

- [ ] **2.3 CodeMirror 6 编辑器**
  - `src/client/components/editor/MarkdownEditor.tsx`
  - CommonMark + GFM 支持
  - 快捷键（加粗、斜体、代码块、链接、保存）
  - 图片上传 → R2
  - 自动保存（3 秒防抖）

- [ ] **2.4 Markdown 渲染管线**
  - `src/services/render.service.ts`（unified + comark + remark-gfm + shiki）
  - SSR 渲染为完整 HTML

- [ ] **2.5 公开 SSR 页面**
  - `src/routes/ssr.ts`：首页 `/`、笔记详情 `/note/:slug`、标签页 `/tag/:tag`
  - KV 缓存 + 失效策略
  - OG 标签、meta 标签

- [ ] **2.6 管理后台 SPA**
  - 笔记列表页（分页、筛选）
  - 编辑器页（创建/编辑）
  - 发布/取消发布

- [ ] **2.7 附件上传**
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

- [ ] **3.1 评论 CRUD**
  - `src/db/repositories/comment.repo.ts`
  - `src/services/comment.service.ts`（双层审核逻辑）
  - `src/routes/api/comments.ts`
  - Zod Schema：`src/shared/schemas/comment.ts`
  - TanStack Query：`src/client/queries/comments.ts`

- [ ] **3.2 评论前端组件**
  - `CommentForm.tsx`（React Hook Form + Zod 校验）
  - `CommentList.tsx`（分页加载）
  - `CommentItem.tsx`（审核状态标记）
  - `CommentReview.tsx`（作者审核：通过/拒绝）

- [ ] **3.3 用户审批**
  - `PATCH /api/admin/users/:id/approval`
  - `GET /api/admin/users/pending`
  - 管理后台用户管理页面：审批/拒绝/角色变更

- [ ] **3.4 管理员后台**
  - 用户列表 + 审批操作
  - 评论管理（隐藏/显示）
  - 站点设置（KV 存储）

- [ ] **3.5 Rate Limiter DO**
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

- [ ] **4.1 Yjs 集成**
  - 安装 `yjs`、`y-websocket`、`y-codemirror.next`
  - `src/client/hooks/useCollab.ts`：Yjs Doc 创建 + WebSocket 连接
  - `y-codemirror.next` 绑定 CodeMirror 6

- [ ] **4.2 CollaborationRoomDO**
  - `src/do/collaboration-room.do.ts`
  - Yjs 文档状态管理
  - y-websocket 协议实现
  - WebRTC 信令中转
  - 权限校验（editor vs viewer）
  - 持久化：Yjs 状态 → Markdown → D1

- [ ] **4.3 协作者 UI**
  - `CollabPresence.tsx`：在线用户列表 + 光标颜色
  - 协作者光标在编辑器中显示
  - WebSocket 连接状态指示器

- [ ] **4.4 WebRTC P2P 升级**
  - `y-webrtc` 集成
  - 2+ 人时自动尝试 P2P
  - 连接失败自动回退 WebSocket

- [ ] **4.5 只读预览**
  - `POST /api/collab/preview/:noteId`
  - viewer 角色加入 CollaborationRoomDO
  - 预览页面（SSR + WebSocket hydration）

- [ ] **4.6 协作会话管理**
  - `src/db/repositories/collab-session.repo.ts`
  - 会话创建/过期/关闭
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

- [ ] **5.1 搜索功能**
  - D1 `LIKE` 查询 + 前端防抖
  - `GET /api/search`

- [ ] **5.2 SEO 优化**
  - meta 标签、OG 标签
  - sitemap.xml 生成
  - robots.txt

- [ ] **5.3 暗色模式**
  - Tailwind `dark:` 变体
  - `class` 策略切换
  - Zustand `ui-store` 持久化偏好

- [ ] **5.4 移动端适配**
  - 响应式布局（Tailwind 断点）
  - 编辑器移动端优化（虚拟键盘处理）
  - 触摸手势

- [ ] **5.5 性能优化**
  - SSR 缓存命中率监控
  - Yjs 增量更新大小优化
  - Vite 代码分割
  - 图片懒加载

- [ ] **5.6 测试**
  - Vitest 单元测试（Service 层、Zod Schema）
  - Miniflare 集成测试（API 路由、RBAC）
  - Playwright E2E 测试（登录、笔记 CRUD、评论审核）

- [ ] **5.7 CI/CD**
  - GitHub Actions：lint + typecheck + test + build
  - `wrangler deploy` 自动部署
  - PR Preview 环境

- [ ] **5.8 自定义域名**
  - Cloudflare Custom Domain 配置
  - WebAuthn RP_ID 更新

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
