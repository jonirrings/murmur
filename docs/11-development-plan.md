## 11. 开发计划

### Phase 1：基础骨架（Week 1-2）

- [x] 项目初始化：Hono + Vite + TypeScript + Wrangler
- [x] Tailwind CSS v4 配置（~~未使用 shadcn/ui~~，纯 Tailwind 手写组件）
- [x] Zustand + TanStack Query 状态管理层搭建
- [x] D1 数据库建表与迁移（Drizzle ORM schema 定义 + drizzle-kit generate + admin 插件字段）
- [x] better-auth 集成（Magic Link + Passkey + TOTP 2FA + admin 插件 + role/approval_status/banned 扩展字段）
- [x] OOBE 初始化流程（检测无 admin → 引导创建）
- [x] RBAC 中间件（requireAuth / requireApproved / requireAuthor / requireAdmin）
- [x] 基础 CRUD API（笔记创建、编辑、删除，含 author_id）
- [x] SSR 重构为 hono/jsx 组件（`src/components/ssr/` + `src/routes/ssr.tsx`）
- [x] Workers Assets 配置（`[assets]` + `ASSETS` 绑定 + SPA 模式）
- [x] TanStack Router 替代 react-router-dom（文件路由 + 自动代码分割）
- [x] i18n 双语支持（i18next + react-i18next + 服务端 detectLocale/t）
      ~~CodeMirror 6 编辑器集成~~（Phase 4）
      ~~comark Markdown 渲染管线~~ → 使用 remark-parse + remark-gfm + rehype-sanitize

### Phase 2：核心功能（Week 3-4）

- [x] 笔记发布/取消发布
- [x] 标签系统
- [x] 图片上传（R2）
- [x] 评论系统（双层审核：用户审批 + 作者审核，React Hook Form + Zod 校验，评论 ≤200 字符）
- [x] 管理员后台：用户角色管理 + 用户审批（pending/approved/rejected）
- [x] 管理员后台：评论管理（隐藏/显示）
- [x] 笔记作者：评论审核（通过/拒绝）
- [x] SSR 公开页面（首页、笔记详情、标签页、评论展示）
- [x] KV 缓存与失效（locale 后缀 key）
- [x] 自动保存

### Phase 3：协作编辑与实时预览（Week 5-7）

- [x] Yjs + y-codemirror.next 集成（`useCollabEditor` hook）
- [x] CollaborationRoomDO 实现（Yjs 文档状态 + WebSocket 中继 + Hibernation API）
- [x] y-websocket 客户端连接与同步（sync step 1/2 协议实现）
- [x] 协作者光标与 Awareness 协议（CollabPresence 组件 + 连接状态指示器）
- [x] WebRTC P2P 传输（y-webrtc + DO 信令）
- [x] WebSocket/WebRTC 自动切换与回退
- [x] 只读预览模式（viewer 角色 WebSocket 端点）
- [x] DO 持久化：Yjs 状态 → D1 Markdown 同步
- [x] 预览 token 生成与过期机制

### Phase 4：打磨上线（Week 8-9）

- [x] 搜索功能（D1 LIKE 查询）
- [x] SEO 优化（meta、OG 标签、sitemap）
- [x] 暗色模式
- [x] 移动端适配（编辑器 dvh、工具栏滚动、浮动保存按钮、筛选栏 flex-wrap）
- [x] 性能优化（图片懒加载、Vite vendor splitting）
- [ ] 自定义域名绑定
- [x] CI/CD（GitHub Actions：lint + typecheck + test + build）
- [x] 实时访客计数器（VisitorCounterDO + WebSocket + SSR 脚本）
- [x] 笔记阅读量统计（ViewTrackerService + 反爬虫 + CF Analytics 校准）
- [x] 评论长度限制调整为 200 字符
- [ ] 部署上线

---
