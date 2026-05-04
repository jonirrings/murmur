## 2. 技术选型

### 2.1 总览

| 层级         | 选型                                                                           | 理由                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **运行时**   | Cloudflare Workers                                                             | 用户指定；全球边缘部署，冷启动极快                                                                                                                                                   |
| **框架**     | Hono v4                                                                        | Workers 生态首选框架，原生 WebSocket 支持，轻量（14KB），SSR 能力完备                                                                                                                |
| **前端渲染** | React 19 + Vite + TanStack Router                                              | SSR 通过 Hono hono/jsx 渲染 HTML，管理后台为 Vite 构建的 React SPA（TanStack Router 文件路由）；公开页面仅轻量交互                                                                   |
| **CSS 框架** | Tailwind CSS v4                                                                | 原子化 CSS，Vite 集成零配置，SSR 友好                                                                                                                                                |
| **组件库**   | Tailwind CSS 手写组件                                                          | Phase 1-3 未引入 shadcn/ui，使用纯 Tailwind 工具类构建 UI；后续可按需引入                                                                                                            |
| **状态管理** | Zustand + TanStack Query                                                       | Zustand 管理 UI 状态（sidebarOpen、theme、locale）；TanStack Query 管服务端状态（API 缓存、乐观更新）                                                                                |
| **表单验证** | React Hook Form + Zod                                                          | 类型安全的表单管理 + Schema 校验，评论/登录/设置表单统一方案                                                                                                                         |
| **数据库**   | Cloudflare D1                                                                  | Workers 原生 SQLite，零延迟访问，适合结构化笔记数据                                                                                                                                  |
| **ORM**      | Drizzle ORM                                                                    | 类型安全的 D1 查询层，零运行时开销，自动迁移生成，~15KB gzipped                                                                                                                      |
| **对象存储** | Cloudflare R2                                                                  | 图片/附件存储，S3 兼容 API，无出站流量费                                                                                                                                             |
| **缓存**     | Cloudflare KV                                                                  | 已发布笔记的 SSR 缓存，TTL 策略自动失效                                                                                                                                              |
| **实时协作** | Cloudflare Durable Objects + Yjs                                               | DO 管理 WebSocket 连接与信令；Yjs 提供 CRDT 无冲突编辑，天然支持离线与并发                                                                                                           |
| **P2P 传输** | WebRTC（可选）                                                                 | y-webrtc 支持 P2P 数据通道，降低服务端负载；DO 作为信令服务器                                                                                                                        |
| **认证**     | better-auth                                                                    | 用户指定；启用 Magic Link 登录（better-auth magicLink 插件）+ Passkey（@better-auth/passkey）+ TOTP 2FA（better-auth twoFactor 插件）+ admin 插件（用户管理/封禁）                   |
| **Markdown** | remark-parse + remark-gfm + remark-rehype + rehype-sanitize + rehype-stringify | remark-parse 负责 CommonMark 解析，remark-gfm 负责表格/删除线等扩展，remark-rehype 转 HAST，rehype-sanitize 防 XSS，rehype-stringify 输出 HTML；~~rehype-shiki 代码高亮~~ 待 Phase 5 |
| **编辑器**   | CodeMirror 6 + y-codemirror.next                                               | 可编程编辑器，y-codemirror.next 提供原生 Yjs 绑定，无缝协作编辑                                                                                                                      |
| **CRDT**     | Yjs                                                                            | 成熟的 CRDT 实现，支持任意数量并发编辑者，离线合并无冲突，生态完善                                                                                                                   |
| **代码高亮** | Shiki                                                                          | SSR 友好，支持 VS Code 主题                                                                                                                                                          |
| **部署**     | Wrangler CLI                                                                   | Cloudflare 官方部署工具，D1 迁移、KV 管理、DO 绑定一体化                                                                                                                             |

### 2.2 选型决策记录

#### 为什么是 Hono 而不是 Remix / Astro / SvelteKit？

| 维度                 | Hono           | Remix        | Astro  | SvelteKit  |
| -------------------- | -------------- | ------------ | ------ | ---------- |
| Workers 冷启动       | ~2ms           | ~50ms        | ~30ms  | ~20ms      |
| WebSocket 支持       | 原生           | 需额外适配   | 不支持 | 需额外适配 |
| Durable Objects 集成 | 原生           | 需适配层     | 不支持 | 需适配层   |
| Bundle 大小          | 14KB           | ~80KB        | ~60KB  | ~40KB      |
| SSR 灵活度           | 高（手动控制） | 高（约定式） | 中     | 高         |

关键因素：实时预览需要 WebSocket + Durable Objects，Hono 是唯一原生支持且冷启动最优的方案。

#### 为什么是 React 而不是 Preact / Solid？

- better-auth 官方提供 React hooks
- CodeMirror 的 React 绑定（@codemirror/view）生态更成熟
- SSR + Hydration 方案在 Hono 中文档最完善
- Preact 可作为后续优化选项（alias 替换即可）

#### 为什么是 D1 而不是 KV 存笔记？

KV 是最终一致的键值存储，不适合需要查询、排序、分页的结构化数据。D1 是 SQLite，支持 SQL 查询、事务、索引，适合笔记的标签筛选、全文搜索、时间排序。

#### 为什么是 Durable Objects 做实时协作？

Durable Objects 在协作场景中承担三重角色：

1. **WebSocket 服务器**：y-websocket 协议的中继，管理房间内的所有连接
2. **Yjs 文档持久化**：存储 Yjs 文档的增量更新，新加入者可从 DO 恢复完整文档状态
3. **WebRTC 信令服务器**：为 y-webrtc 的 P2P 连接提供信令交换

Durable Objects 的优势：

- 单点状态管理（无需分布式共识）
- 自动垃圾回收（会话结束即销毁）
- 与 Workers 同区域部署（低延迟）
- 有状态存储（Yjs update 可持久化到 DO storage）

#### 为什么是 Yjs 而不是 Automerge / 原生 OT？

| 维度            | Yjs                       | Automerge       | OT (自研)  |
| --------------- | ------------------------- | --------------- | ---------- |
| CodeMirror 绑定 | y-codemirror.next（成熟） | 无官方绑定      | 需自研     |
| Bundle 大小     | ~45KB (gzipped)           | ~150KB          | 不定       |
| 离线支持        | 天然支持                  | 天然支持        | 需额外实现 |
| WebSocket 适配  | y-websocket（官方）       | 无官方方案      | 需自研     |
| WebRTC 适配     | y-webrtc（官方）          | 无官方方案      | 不适用     |
| Workers 兼容性  | 纯 JS，无 native 依赖     | 含 WASM，需验证 | 不定       |

关键因素：Yjs + CodeMirror 6 的绑定最成熟，同时支持 WebSocket 和 WebRTC 两种传输模式。

#### 为什么同时支持 WebSocket 和 WebRTC？

| 维度       | WebSocket（DO 中继）    | WebRTC（P2P）       |
| ---------- | ----------------------- | ------------------- |
| 连接方式   | 客户端 → DO → 客户端    | 客户端 ↔ 客户端     |
| 防火墙穿透 | 始终可用                | 部分网络受限        |
| 延迟       | ~50-100ms（经 DO 转发） | ~10-30ms（直连）    |
| 服务端负载 | 所有流量经 DO           | 仅信令经 DO         |
| 适用场景   | 默认模式，稳定可靠      | 2+ 人协作时自动升级 |
| 离线恢复   | DO 持久化 Yjs 状态      | 需回退到 WebSocket  |

策略：优先 WebSocket，当房间内有 2+ 人时自动尝试 WebRTC 升级；连接断开时回退到 WebSocket。

#### 为什么用 Drizzle ORM 而不是手写 SQL？

| 维度        | 手写 SQL                        | Drizzle ORM                                                                            |
| ----------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| 返回类型    | `any`，字段拼错运行时才炸       | 完整类型推断，每个字段编译期检查                                                       |
| Schema 声明 | 散落在 SQL 文件里               | TypeScript 单一来源，改字段类型编译器立即报错                                          |
| 迁移管理    | 手写 `0001_initial.sql`         | `drizzle-kit generate` 自动 diff 生成                                                  |
| D1 适配     | `env.DB.prepare().bind().run()` | `drizzle(d1(env.DB))` 或 `drizzleAdapter(db, { provider: 'sqlite', schema })` 一行接入 |
| Bundle      | 0                               | ~15KB gzipped（Workers 场景可忽略）                                                    |
| 复杂查询    | 无限制                          | 支持原始 SQL 回退：`db.run(sql\`...\`)`                                                |

关键因素：D1 原生 API 返回 `any`，在多层审核评论查询等复杂 JOIN 场景下类型安全至关重要；Drizzle 的 query builder 近似 SQL，学习成本极低。

#### 为什么选 Tailwind 手写组件（原设计 shadcn/ui + Tailwind）？

| 维度        | Tailwind 手写    | shadcn/ui + Tailwind | Ant Design / MUI          |
| ----------- | ---------------- | -------------------- | ------------------------- |
| 运行时开销  | 零               | 零（代码拷入项目）   | 大（运行时主题引擎）      |
| 可定制性    | 完全控制         | 完全控制源码         | 受限（token 覆盖）        |
| Bundle 大小 | 最小             | 按需引入             | 全量引入或复杂 tree-shake |
| SSR 兼容    | 原生             | 原生                 | 需配置                    |
| 开发速度    | 较慢（手写样式） | 快（组件现成）       | 快（组件现成）            |
| 无障碍访问  | 需手动处理       | Radix 原语，WCAG 2.1 | 内置                      |

当前选择 Tailwind 手写组件的原因：Phase 1-3 组件简单（表单、表格、卡片），shadcn/ui 引入成本高于收益。后续若组件复杂度增加可按需引入 shadcn/ui。

#### 为什么是 Zustand + TanStack Query 而不是 Redux / Jotai / SWR？

- **Zustand**：极简 API（~1KB），适合编辑器状态、UI 开关等纯客户端状态
- **TanStack Query**：服务端状态缓存、乐观更新、分页加载是笔记列表和评论的刚需
- **不选 Redux**：本项目的服务端状态复杂度远高于客户端状态，Redux 的 boilerplate 不值得
- **不选 SWR**：TanStack Query 的 mutation + optimistic update 更成熟，评论审核场景需要

#### 为什么是 React Hook Form + Zod？

- React Hook Form：非受控表单，重渲染最少，评论/登录表单体验好
- Zod：与 Drizzle Schema 类型共享，API 输入校验和表单校验用同一套 Schema
- 组合：`@hookform/resolvers/zod` 一行接入，类型从 Schema 自动推导

---
