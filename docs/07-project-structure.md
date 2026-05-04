## 7. 项目结构

```
murmur/
├── src/
│   ├── index.ts                    # Hono 入口，路由注册 + Cron Trigger 清理
│   ├── app.ts                      # Hono app 实例与中间件 + ASSETS SPA/静态资源服务
│   │
│   ├── routes/                     # 路由定义
│   │   ├── ssr.tsx                 # 公开页面 SSR 路由（hono/jsx 组件）
│   │   ├── api/
│   │   │   ├── auth.ts             # 认证 API
│   │   │   ├── setup.ts            # OOBE 初始化 API
│   │   │   ├── admin.ts            # 管理员 API（用户管理、站点设置）
│   │   │   ├── notes.ts            # 笔记 CRUD
│   │   │   ├── comments.ts         # 评论 CRUD
│   │   │   ├── tags.ts             # 标签管理
│   │   │   ├── attachments.ts      # 附件上传
│   │   │   ├── preview.ts          # 预览会话
│   │   │   └── search.ts           # 搜索
│   │   └── preview.ts              # 预览页面路由
│   │
│   ├── components/
│   │   └── ssr/                    # hono/jsx SSR 组件
│   │       ├── layout.tsx          # HtmlDocument 外壳
│   │       ├── note-card.tsx       # 笔记卡片
│   │       ├── note-detail.tsx     # 笔记详情 + 列表/标签/预览/错误页
│   │       ├── comment-item.tsx    # 评论项
│   │       └── pagination.tsx      # 分页
│   │
│   ├── services/                   # 业务逻辑
│   │   ├── note.service.ts
│   │   ├── comment.service.ts
│   │   ├── tag.service.ts
│   │   ├── attachment.service.ts
│   │   ├── preview.service.ts
│   │   ├── search.service.ts
│   │   ├── user.service.ts         # 用户角色管理
│   │   ├── setup.service.ts        # OOBE 初始化逻辑
│   │   ├── cache.service.ts        # KV 缓存管理
│   │   ├── render.service.ts       # Markdown → HTML 渲染
│   │   └── view-tracker.service.ts # 阅读量统计（反爬虫 + CF 校准）
│   │
│   ├── db/                         # D1 数据层 (Drizzle ORM)
│   │   ├── schema.ts               # Drizzle Schema 定义（Single Source of Truth）
│   │   ├── client.ts               # Drizzle + D1 初始化
│   │   ├── migrations/             # drizzle-kit generate 自动生成
│   │   └── repositories/           # 数据访问层
│   │       ├── note.repo.ts
│   │       ├── comment.repo.ts
│   │       ├── tag.repo.ts
│   │       ├── attachment.repo.ts
│   │       ├── user.repo.ts
│   │       └── collab-session.repo.ts
│   │
│   ├── do/                         # Durable Objects
│   │   ├── collaboration-room.do.ts # 协作房间 DO（Yjs + WebSocket + WebRTC 信令）
│   │   ├── rate-limiter.do.ts       # 限流 DO（评论/注册/登录）
│   │   └── visitor-counter.do.ts    # 访客计数 DO（WebSocket 实时在线统计）
│   │
│   ├── auth/                       # 认证配置
│   │   ├── better-auth.config.ts
│   │   ├── middleware.ts           # 认证守卫中间件
│   │   ├── rbac.ts                 # 角色层级与工具函数（hasRole / isAdmin / isAuthorOrAbove）
│   │   └── turnstile.ts            # Turnstile 人机验证
│   │
│   ├── client/                     # 客户端 SPA（TanStack Router 管理后台）
│   │   ├── main.tsx                # React 入口（createRouter + RouterProvider + i18n init）
│   │   ├── app.tsx                 # LocaleSync 组件
│   │   ├── routeTree.gen.ts        # 自动生成路由树
│   │   ├── routes/                 # TanStack Router 文件路由
│   │   │   ├── __root.tsx          # 根布局（QueryClientProvider + ThemeProvider + LocaleSync）
│   │   │   ├── setup.tsx
│   │   │   ├── login.tsx
│   │   │   ├── admin.tsx           # Admin 布局（侧边栏 + 认证守卫）
│   │   │   ├── admin/dashboard.tsx
│   │   │   ├── admin/notes.tsx
│   │   │   ├── admin/notes/new.tsx
│   │   │   ├── admin/notes/$id.edit.tsx
│   │   │   ├── admin/users.tsx
│   │   │   ├── admin/comments.tsx
│   │   │   └── admin/settings.tsx
│   │   ├── i18n/                   # i18next 配置
│   │   │   ├── index.ts            # i18next.init()
│   │   │   └── locales/            # 按语言/命名空间组织
│   │   │       ├── zh-CN/          # common, admin, auth, editor, comments
│   │   │       └── en/             # common, admin, auth, editor, comments
│   │   ├── pages/                  # 页面组件（被 routes/ 引用）
│   │   │   ├── setup.tsx           # OOBE 初始化页面
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── editor.tsx          # Markdown 编辑器（author）
│   │   │   ├── notes-list.tsx      # 笔记列表
│   │   │   ├── admin/
│   │   │   │   ├── users.tsx       # 用户管理 + 审批（admin）
│   │   │   │   ├── comments.tsx    # 评论管理（admin）
│   │   │   │   └── settings.tsx    # 站点设置（admin）
│   │   │   └── settings.tsx
│   │   ├── components/
│   │   │   # (no ui/ dir — 未使用 shadcn/ui)
│   │   │   ├── editor/
│   │   │   │   ├── MarkdownEditor.tsx    # CodeMirror 编辑器 + Yjs 绑定
│   │   │   │   ├── CollabPresence.tsx    # 协作者在线状态 & 光标
│   │   │   │   ├── PreviewPanel.tsx      # 本地预览面板
│   │   │   │   ├── Toolbar.tsx           # 编辑工具栏
│   │   │   │   └── ImageUploader.tsx     # 图片上传
│   │   │   ├── comments/
│   │   │   │   ├── CommentList.tsx       # 评论列表
│   │   │   │   ├── CommentForm.tsx       # 评论输入框（React Hook Form + Zod）
│   │   │   │   ├── CommentItem.tsx       # 单条评论（含审核状态）
│   │   │   │   └── CommentReview.tsx     # 作者审核评论组件
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx          # 全局布局壳（侧边栏 + 顶栏）
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       └── ConfirmDialog.tsx
│   │   ├── stores/                 # Zustand 状态管理
│   │   │   ├── ui-store.ts         # UI 状态（主题、侧边栏、locale）
│   │   │   └── collab-store.ts     # 协作状态（在线用户、光标颜色映射）
│   │   ├── queries/                # TanStack Query 查询与变更
│   │   │   ├── notes.ts            # 笔记 CRUD + 缓存策略
│   │   │   ├── comments.ts         # 评论 CRUD + 乐观更新
│   │   │   ├── tags.ts             # 标签查询
│   │   │   ├── users.ts            # 用户管理（admin）
│   │   │   └── auth.ts             # 认证状态查询
│   │   ├── schemas/                # Zod Schema（表单校验 + API 校验共享）
│   │   │   ├── note.ts             # 笔记创建/更新 Schema
│   │   │   ├── comment.ts          # 评论 Schema
│   │   │   ├── auth.ts             # 登录/注册 Schema
│   │   │   └── user.ts             # 用户管理 Schema
│   │   ├── hooks/
│   │   │   ├── useAutoSave.ts
│   │   │   ├── useCollabEditor.ts      # 协作编辑 Hook（Yjs + WebSocket/WebRTC + 自动切换）
│   │   │   ├── usePreview.ts            # 实时预览 Hook
│   │   │   ├── useAuth.ts
│   │   │   └── useRole.ts               # 角色权限 Hook
│   │   └── lib/                    # 客户端工具
│   │       ├── api.ts              # fetchApi 通用客户端 + ApiError
│   │       ├── cn.ts               # clsx + tailwind-merge 工具函数
│   │       ├── zod-i18n.ts         # Zod error map with i18n
│   │       ├── api-error.ts        # 本地化 API 错误映射
│   │       ├── relative-time.ts    # i18n 感知的相对时间格式化
│   │       └── format.ts           # 日期/金额格式化
│   │
│   └── shared/                     # 前后端共享
│       ├── types.ts                # TypeScript 类型
│       ├── constants.ts            # 常量定义
│       ├── rbac.ts                 # 角色定义与权限常量
│       ├── i18n/                   # 服务端 i18n
│       │   ├── server.ts           # detectLocale() + t()
│       │   └── locales/            # zh-CN.json, en.json（SSR 专用）
│       └── schemas/                # Zod Schema（前后端共享校验）
│           ├── note.ts             # 笔记创建/更新 Schema
│           ├── comment.ts          # 评论 Schema
│           ├── auth.ts             # 登录/注册 Schema
│           └── user.ts             # 用户管理 Schema
│
├── public/                         # 静态资源
│   ├── favicon.ico
│   └── og-image.png
│
├── migrations/                     # D1 迁移（drizzle-kit generate 自动生成）
│   ├── 0000_initial.sql
│   └── ...
│
├── drizzle.config.ts               # Drizzle Kit 配置
├── tailwind.config.ts              # Tailwind CSS v4 配置
# (components.json — 未引入 shadcn/ui)
├── wrangler.toml                   # Cloudflare Workers 配置（含 [assets] SPA 配置）
├── wrangler.dev.toml               # 本地开发配置覆盖
├── package.json
├── tsconfig.json
├── vite.config.ts                  # 客户端构建（含 tanstackRouter + move-index-html 插件）
└── README.md
```

---
