# Murmur — 灵光与知识的记录场

> 偶尔的灵光、某时学到的知识、可能会反复遇到的技巧。

---

## 1. 产品定位

Murmur 是一个面向个人的轻量笔记系统，核心诉求是**快**——快速记录、快速呈现、快速检索。它不是知识库管理系统，而是"捕捉灵光"的工具：打开即写，发布即见。

### 1.1 核心场景

| 场景 | 描述 |
|------|------|
| 灵光记录 | 随时记下一个想法、一个灵感，无需分类，标签即可 |
| 知识沉淀 | 把某时学到的知识点以 Markdown 写下，日后可检索 |
| 技巧备忘 | 反复遇到的技巧、命令、配方，记下来方便下次查阅 |
| 实时预览 | 编辑时生成预览链接，分享给他人实时查看编写进度 |

### 1.2 非目标

- 不做全站 CMS / 博客系统
- 不做 OT（Operational Transformation）协作——仅使用 CRDT

---

## 2. 技术选型

### 2.1 总览

| 层级 | 选型 | 理由 |
|------|------|------|
| **运行时** | Cloudflare Workers | 用户指定；全球边缘部署，冷启动极快 |
| **框架** | Hono v4 | Workers 生态首选框架，原生 WebSocket 支持，轻量（14KB），SSR 能力完备 |
| **前端渲染** | React 19 + Vite | SSR 通过 Hono 的 `hono/jsx` 服务端渲染，客户端 hydration 用 React；生态成熟，编辑器组件丰富 |
| **CSS 框架** | Tailwind CSS v4 | 原子化 CSS，Vite 集成零配置，SSR 友好，与 shadcn/ui 天然搭配 |
| **组件库** | shadcn/ui + Radix UI | 基于 Radix 原语的可定制组件，代码直接拷入项目零运行时依赖，Tailwind 原生 |
| **状态管理** | Zustand + TanStack Query | Zustand 管客户端状态（编辑器、UI）；TanStack Query 管服务端状态（API 缓存、乐观更新） |
| **表单验证** | React Hook Form + Zod | 类型安全的表单管理 + Schema 校验，评论/登录/设置表单统一方案 |
| **数据库** | Cloudflare D1 | Workers 原生 SQLite，零延迟访问，适合结构化笔记数据 |
| **ORM** | Drizzle ORM | 类型安全的 D1 查询层，零运行时开销，自动迁移生成，~15KB gzipped |
| **对象存储** | Cloudflare R2 | 图片/附件存储，S3 兼容 API，无出站流量费 |
| **缓存** | Cloudflare KV | 已发布笔记的 SSR 缓存，TTL 策略自动失效 |
| **实时协作** | Cloudflare Durable Objects + Yjs | DO 管理 WebSocket 连接与信令；Yjs 提供 CRDT 无冲突编辑，天然支持离线与并发 |
| **P2P 传输** | WebRTC（可选） | y-webrtc 支持 P2P 数据通道，降低服务端负载；DO 作为信令服务器 |
| **认证** | better-auth | 用户指定；原生支持 WebAuthn/Passkey，轻量，适配 Edge Runtime |
| **Markdown** | comark + remark/rehype 生态 | comark 负责 CommonMark 解析，remark/rehype 负责插件扩展（GFM、代码高亮、数学公式等） |
| **编辑器** | CodeMirror 6 + y-codemirror.next | 可编程编辑器，y-codemirror.next 提供原生 Yjs 绑定，无缝协作编辑 |
| **CRDT** | Yjs | 成熟的 CRDT 实现，支持任意数量并发编辑者，离线合并无冲突，生态完善 |
| **代码高亮** | Shiki | SSR 友好，支持 VS Code 主题 |
| **部署** | Wrangler CLI | Cloudflare 官方部署工具，D1 迁移、KV 管理、DO 绑定一体化 |

### 2.2 选型决策记录

#### 为什么是 Hono 而不是 Remix / Astro / SvelteKit？

| 维度 | Hono | Remix | Astro | SvelteKit |
|------|------|-------|-------|-----------|
| Workers 冷启动 | ~2ms | ~50ms | ~30ms | ~20ms |
| WebSocket 支持 | 原生 | 需额外适配 | 不支持 | 需额外适配 |
| Durable Objects 集成 | 原生 | 需适配层 | 不支持 | 需适配层 |
| Bundle 大小 | 14KB | ~80KB | ~60KB | ~40KB |
| SSR 灵活度 | 高（手动控制） | 高（约定式） | 中 | 高 |

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

| 维度 | Yjs | Automerge | OT (自研) |
|------|-----|-----------|-----------|
| CodeMirror 绑定 | y-codemirror.next（成熟） | 无官方绑定 | 需自研 |
| Bundle 大小 | ~45KB (gzipped) | ~150KB | 不定 |
| 离线支持 | 天然支持 | 天然支持 | 需额外实现 |
| WebSocket 适配 | y-websocket（官方） | 无官方方案 | 需自研 |
| WebRTC 适配 | y-webrtc（官方） | 无官方方案 | 不适用 |
| Workers 兼容性 | 纯 JS，无 native 依赖 | 含 WASM，需验证 | 不定 |

关键因素：Yjs + CodeMirror 6 的绑定最成熟，同时支持 WebSocket 和 WebRTC 两种传输模式。

#### 为什么同时支持 WebSocket 和 WebRTC？

| 维度 | WebSocket（DO 中继） | WebRTC（P2P） |
|------|---------------------|---------------|
| 连接方式 | 客户端 → DO → 客户端 | 客户端 ↔ 客户端 |
| 防火墙穿透 | 始终可用 | 部分网络受限 |
| 延迟 | ~50-100ms（经 DO 转发） | ~10-30ms（直连） |
| 服务端负载 | 所有流量经 DO | 仅信令经 DO |
| 适用场景 | 默认模式，稳定可靠 | 2+ 人协作时自动升级 |
| 离线恢复 | DO 持久化 Yjs 状态 | 需回退到 WebSocket |

策略：优先 WebSocket，当房间内有 2+ 人时自动尝试 WebRTC 升级；连接断开时回退到 WebSocket。

#### 为什么用 Drizzle ORM 而不是手写 SQL？

| 维度 | 手写 SQL | Drizzle ORM |
|------|---------|-------------|
| 返回类型 | `any`，字段拼错运行时才炸 | 完整类型推断，每个字段编译期检查 |
| Schema 声明 | 散落在 SQL 文件里 | TypeScript 单一来源，改字段类型编译器立即报错 |
| 迁移管理 | 手写 `0001_initial.sql` | `drizzle-kit generate` 自动 diff 生成 |
| D1 适配 | `env.DB.prepare().bind().run()` | `drizzle(d1(env.DB))` 一行接入 |
| Bundle | 0 | ~15KB gzipped（Workers 场景可忽略） |
| 复杂查询 | 无限制 | 支持原始 SQL 回退：`db.run(sql\`...\`)` |

关键因素：D1 原生 API 返回 `any`，在多层审核评论查询等复杂 JOIN 场景下类型安全至关重要；Drizzle 的 query builder 近似 SQL，学习成本极低。

#### 为什么是 shadcn/ui + Tailwind 而不是 Ant Design / MUI / Chakra UI？

| 维度 | shadcn/ui + Tailwind | Ant Design / MUI | Chakra UI |
|------|---------------------|------------------|-----------|
| 运行时开销 | 零（代码拷入项目） | 大（运行时主题引擎） | 中 |
| 可定制性 | 完全控制源码 | 受限（token 覆盖） | 中等 |
| Bundle 大小 | 按需引入 | 全量引入或复杂 tree-shake | 中等 |
| SSR 兼容 | 原生 | 需配置 | 需配置 |
| 无障碍访问 | Radix 原语，WCAG 2.1 | 内置 | 内置 |
| Tailwind 集成 | 原生 | 需额外配置 | 不支持 |

关键因素：Workers 环境对 bundle 大小敏感；shadcn/ui 零运行时依赖 + Radix 无障碍 + Tailwind 原生集成是最优组合。

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

## 3. 架构设计

### 3.1 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                               │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │Public SSR │ │Admin SPA │ │Author SPA│ │  Collaborative Editor  │ │
│  │(Note+Comment)│(User Mgmt)│ (Editor)  │ │ (Yjs + CodeMirror 6)  │ │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘ └──────────┬─────────────┘ │
│        │            │            │                    │              │
│  ┌─────▼────────────▼────────────▼────────────────────▼───────────┐ │
│  │                        Hono Router                              │ │
│  │  ┌────────┐ ┌──────────┐ ┌──────┐ ┌──────────────────────────┐ │ │
│  │  │  SSR   │ │ REST API │ │ OOBE │ │  WebSocket + Signaling   │ │ │
│  │  │ Routes │ │ + RBAC   │ │Route │ │  (Collab + Preview)      │ │ │
│  │  └───┬────┘ └────┬─────┘ └──┬───┘ └───────────┬──────────────┘ │ │
│  └──────┼────────────┼──────────┼─────────────────┼────────────────┘ │
│         │            │          │                 │                  │
│  ┌──────▼────┐ ┌─────▼─────┐  │  ┌──────────────▼───────────────┐ │
│  │ KV Cache  │ │    D1     │  │  │     Durable Objects          │ │
│  │ (Read)    │ │  (R/W)    │  │  │  ┌─────────────────────────┐ │ │
│  └───────────┘ └───────────┘  │  │  │ CollaborationRoomDO     │ │ │
│                     ▲         │  │  │ - Yjs doc state         │ │ │
│                     │    ┌────┴────┤ │ - WebSocket relay       │ │ │
│                     └────┤  R2     │ │ - WebRTC signaling      │ │ │
│                          │(Assets) │ │ - Awareness (光标/选区)   │ │ │
│                          └─────────┘ └─────────────────────────┘ │ │
│                                      └────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Client (Browser)                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │ y-websocket  │  │  y-webrtc    │  │  y-codemirror.next   │ │ │
│  │  │ (默认传输)    │  │ (P2P 升级)   │  │  (编辑器绑定)         │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │ │
│  │         └──────────────────┴─────────────────────┘             │ │
│  │                       Yjs Doc (CRDT)                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 请求流程

#### 公开笔记访问（SSR）

```
Request → Hono Router → KV Cache Hit?
  ├─ Yes → Return cached HTML
  └─ No  → D1 Query → comark Render → HTML Response → Write KV Cache
```

#### 管理后台（SPA + API）

```
Request → Hono Router → better-auth Guard → RBAC 中间件 → REST API → D1 R/W
                                                    │
                                            requireAdmin → 用户管理、角色分配、评论管理
                                            requireAuthor → 笔记 CRUD、发布
                                            requireAuth  → 发表评论
```

#### OOBE 初始化

```
Request → /setup → 检查 users 表是否有 admin
  → 无 admin → 渲染 OOBE 页面 → 创建 admin → 跳转后台
  → 有 admin → 302 重定向到 /login
```

#### 实时协作编辑（CRDT + WebSocket/WebRTC）

```
1. Author 打开笔记编辑器
2. 前端创建 Yjs Doc + y-codemirror.next 绑定
3. 通过 y-websocket 连接到 CollaborationRoomDO（noteId 为房间 ID）
4. DO 从持久化存储恢复 Yjs 状态 → 同步给新加入者
5. 编辑操作 → Yjs 本地更新 → 通过 WebSocket 发送到 DO
6. DO 广播更新给房间内所有连接者
7. 当房间内 ≥2 人时，自动尝试 WebRTC 升级（y-webrtc）
8. WebRTC 信令通过 DO 中转
9. P2P 连接建立后，数据走 WebRTC 直连，WebSocket 降级为备份通道
10. 会话结束时，DO 将最终 Yjs 状态持久化并同步回 D1
```

#### 实时预览（协作的只读模式）

```
预览是协作编辑的只读子集：
1. Editor 点击「分享预览」→ 生成带 token 的预览 URL
2. Viewer 打开 URL → 以 read-only 模式加入同一 CollaborationRoomDO
3. Viewer 接收 Yjs 更新但不发送编辑操作
4. Viewer 的 CodeMirror 实例设为 readOnly，仅渲染最新内容
```

---

## 4. 数据模型

### 4.1 Drizzle Schema（Single Source of Truth）

Schema 定义在 TypeScript 中，由 `drizzle-kit generate` 自动生成 D1 迁移 SQL。

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── better-auth 扩展字段 ───
// better-auth 自动创建 users/sessions/accounts/webauthn_credentials 表
// 以下通过 better-auth additionalFields + Drizzle 迁移脚本添加扩展列

// ─── 笔记 ───
export const notes = sqliteTable('notes', {
  id:           text('id').primaryKey(),              // nanoid
  authorId:     text('author_id').notNull().references(() => users.id),
  title:        text('title').notNull().default(''),
  content:      text('content').notNull().default(''), // Markdown 原文
  excerpt:      text('excerpt').notNull().default(''), // 自动提取前 200 字
  slug:         text('slug').unique(),                 // URL 友好标识
  category:     text('category', { enum: ['note', 'inspiration', 'tip', 'knowledge'] }).notNull().default('note'),
  status:       text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  wordCount:    integer('word_count').notNull().default(0),
  createdAt:    text('created_at').notNull(),          // ISO 8601
  updatedAt:    text('updated_at').notNull(),
  publishedAt:  text('published_at'),                  // nullable
}, (table) => [
  index('idx_notes_status').on(table.status),
  index('idx_notes_category').on(table.category),
  index('idx_notes_author_id').on(table.authorId),
  index('idx_notes_updated_at').on(table.updatedAt),
  index('idx_notes_slug').on(table.slug),
]);

// ─── 标签 ───
export const tags = sqliteTable('tags', {
  id:   text('id').primaryKey(),                       // nanoid
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
});

// ─── 笔记-标签关联 ───
export const noteTags = sqliteTable('note_tags', {
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  tagId:  text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_note_tags_tag_id').on(table.tagId),
]);

// ─── 附件 ───
export const attachments = sqliteTable('attachments', {
  id:        text('id').primaryKey(),                  // nanoid
  noteId:    text('note_id').references(() => notes.id, { onDelete: 'set null' }),
  r2Key:     text('r2_key').notNull(),
  filename:  text('filename').notNull(),
  mimeType:  text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at').notNull(),
});

// ─── 评论 ───
export const comments = sqliteTable('comments', {
  id:              text('id').primaryKey(),             // nanoid
  noteId:          text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  authorId:        text('author_id').notNull().references(() => users.id),
  content:         text('content').notNull(),           // 纯文本
  authorApproved:  integer('author_approved').notNull().default(0), // 0=pending, 1=approved, -1=rejected
  adminHidden:     integer('admin_hidden').notNull().default(0),
  createdAt:       text('created_at').notNull(),
  updatedAt:       text('updated_at').notNull(),
}, (table) => [
  index('idx_comments_note_id').on(table.noteId, table.createdAt),
  index('idx_comments_author_id').on(table.authorId),
  index('idx_comments_pending').on(table.noteId, table.authorApproved),
]);

// ─── 协作会话 ───
export const collabSessions = sqliteTable('collab_sessions', {
  id:        text('id').primaryKey(),                  // nanoid
  noteId:    text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  token:     text('token').unique(),                   // 只读预览令牌
  isActive:  integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

// ─── better-auth 用户表（扩展字段） ───
// better-auth 自动管理 users 表核心字段
// 以下通过迁移脚本添加扩展列
export const users = sqliteTable('users', {
  id:             text('id').primaryKey(),
  email:          text('email').notNull(),
  name:           text('name'),
  image:          text('image'),
  role:           text('role', { enum: ['admin', 'author', 'commenter'] }).notNull().default('commenter'),
  approvalStatus: text('approval_status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  createdAt:      text('created_at').notNull(),
  updatedAt:      text('updated_at').notNull(),
});
```

**迁移流程**：

```bash
# 1. 修改 src/db/schema.ts 后，自动生成迁移 SQL
npx drizzle-kit generate

# 2. 应用迁移到本地 D1
npx wrangler d1 migrations apply murmur-db --local

# 3. 应用迁移到远程 D1
npx wrangler d1 migrations apply murmur-db --remote
```

**Drizzle + D1 初始化**：

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

### 4.2 better-auth Schema

better-auth 会自动创建以下表，此处仅列出关键配置：

```
users                  -- id, email, name, image, created_at, updated_at
                         + role TEXT NOT NULL DEFAULT 'commenter'       (扩展字段)
                         + approval_status TEXT NOT NULL DEFAULT 'pending' (扩展字段)
sessions               -- id, user_id, token, expires_at
accounts               -- id, user_id, provider_id, provider_account_id
webauthn_credentials   -- id, user_id, credential_id, public_key, counter
```

角色字段通过 better-auth 的 `user.additionalFields` 配置添加，注册时默认值为 `commenter` + `pending`。
管理员角色仅在 OOBE 阶段直接写入数据库，不通过注册流程。

#### 评论可见性规则

评论的公开可见性由**两层审核**共同决定：

```
评论是否公开展示？
  ├─ 用户 approval_status ≠ 'approved' → 仅自己可见
  └─ 用户 approval_status = 'approved'
       ├─ comment.author_approved = 1 → 公开可见
       └─ comment.author_approved ≠ 1 → 仅评论者 + 笔记作者可见
```

| 查看者 | 未审核用户的评论 | 已审核用户 + 作者未审 | 已审核用户 + 作者通过 | 管理员隐藏 |
|--------|----------------|---------------------|---------------------|-----------|
| 普通访客 | 不可见 | 不可见 | 可见 | 不可见 |
| 评论者本人 | 可见 | 可见 | 可见 | 不可见 |
| 笔记作者 | 不可见 | 可见（可审核） | 可见 | 不可见 |
| 管理员 | 可见 | 可见 | 可见 | 可见（标记） |

---

## 5. 功能规格

### 5.1 用户角色体系

#### 5.1.1 角色定义

| 角色 | 标识 | 笔记 | 评论 | 管理后台 | 说明 |
|------|------|------|------|---------|------|
| **管理员** | `admin` | 不可创建/发布 | 可以 | 网站管理、角色分配 | 仅 OOBE 阶段预设，不可通过界面创建 |
| **笔记作者** | `author` | 创建/编辑/发布自己的笔记 | 可以 | 查看自己的笔记 | 由管理员从评论者升级 |
| **评论者** | `commenter` | 不可 | 可以 | 不可访问 | 注册后默认角色 |

#### 5.1.2 角色流转

```
注册 ──→ 评论者 ──(管理员升级)──→ 笔记作者
   │                                  │
   └──── 不可直接成为管理员 ───────────┘

管理员：仅 OOBE 阶段创建，数量固定（通常 1 人），不可被降级
```

#### 5.1.3 权限矩阵

| 操作 | 管理员 | 笔记作者 | 评论者（已审核） | 评论者（未审核） | 未登录用户 |
|------|--------|---------|----------------|----------------|-----------|
| 浏览已发布笔记 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 发表评论 | ✅ | ✅ | ✅ | ✅（仅自己可见） | ❌ |
| 创建/编辑笔记 | ❌ | ✅（自己的） | ❌ | ❌ | ❌ |
| 发布笔记 | ❌ | ✅（自己的） | ❌ | ❌ | ❌ |
| 删除笔记 | ❌ | ✅（自己的） | ❌ | ❌ | ❌ |
| 协作编辑笔记 | ❌ | ✅（被邀请的） | ❌ | ❌ | ❌ |
| 审核笔记评论 | ❌ | ✅（自己的笔记） | ❌ | ❌ | ❌ |
| 管理用户角色 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 审批用户（评论可见） | ✅ | ❌ | ❌ | ❌ | ❌ |
| 管理网站设置 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 管理标签 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 进入管理后台 | ✅ | ✅（受限视图） | ❌ | ❌ | ❌ |

#### 5.1.4 OOBE（开箱体验）流程

首次部署时系统检测到无任何用户，自动进入 OOBE 模式：

```
首次访问 /admin
  → 系统检测 users 表为空
    → 重定向到 /setup（OOBE 页面）
      → 创建管理员账号
        → 注册 Passkey / 设置 Email
        → 写入 role = 'admin'
        → 创建 Session
        → 跳转到管理后台
```

OOBE 完成后，`/setup` 路由永久不可访问（由中间件检查 users 表是否已有 admin 用户）。

### 5.2 认证系统

#### 5.2.1 登录方式

| 方式 | 优先级 | 说明 |
|------|--------|------|
| WebAuthn / Passkey | P0 | 主登录方式，无密码，生物识别 |
| Email Magic Link | P1 | 备用登录方式，用于无 Passkey 设备 |

#### 5.2.2 认证流程

```
用户访问 /admin
  → 系统检测无 admin 用户？
    → 是 → 重定向 /setup（OOBE）
    → 否 → 检查 Session (better-auth)
      → 有效 → 检查角色权限
        → admin  → 管理后台（完整权限）
        → author → 管理后台（笔记编辑视图）
        → commenter → 403
      → 无效 → 跳转 /login
        → Passkey 可用 → WebAuthn 认证
        → Passkey 不可用 → Email Magic Link
          → 发送邮件 → 用户点击链接 → 创建 Session → 检查角色 → 进入对应视图
```

#### 5.2.3 Session 策略

- Session 有效期：30 天
- Cookie: `__Secure-session-token`，HttpOnly，SameSite=Lax
- Session 中携带角色信息，每次请求通过中间件校验
- 公开笔记页面无需登录；评论需登录

#### 5.2.4 防滥用体系

| 层级 | 措施 | 说明 |
|------|------|------|
| **注册防护** | Cloudflare Turnstile | 注册/登录页面嵌入 Turnstile Widget，阻止机器人注册 |
| **评论限流** | Durable Objects Rate Limiter | 每用户每笔记 1 条/分钟，每小时 20 条上限 |
| **API 限流** | Cloudflare Rate Limiting Rules | 全局 API 限流：100 req/min/IP，登录接口 10 req/min/IP |
| **评论内容** | 长度限制 + 频率检测 | 单条评论 ≤2000 字符；同一用户 1 分钟内不可重复提交相同内容 |
| **协作连接** | DO 连接数限制 | 单笔记协作房间最多 10 个 editor + 50 个 viewer |
| **预览链接** | Token 过期 + 单次验证 | 预览 token 24h 过期；首次访问后绑定 IP（可选） |

**Turnstile 集成**：

```typescript
// src/middleware/turnstile.ts
// 注册和登录页面验证 Turnstile token
async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${env.TURNSTILE_SECRET_KEY}&response=${token}`,
    }
  );
  const data = await response.json() as { success: boolean };
  return data.success;
}
```

**评论限流（Durable Objects）**：

```typescript
// src/do/rate-limiter.do.ts
export class RateLimiterDO implements DurableObject {
  // 每用户滑动窗口限流
  // key: `${userId}:${action}:${noteId}`
  // 窗口: 1 分钟 / 1 小时
}
```

### 5.3 笔记管理

#### 5.3.1 笔记类型

| 类型 | 标识 | 用途 | 默认可见性 |
|------|------|------|-----------|
| 灵光 | `inspiration` | 短想法、碎片灵感 | 私密 |
| 知识 | `knowledge` | 学到的知识点 | 发布 |
| 技巧 | `tip` | 可复用的技巧/命令 | 发布 |
| 笔记 | `note` | 通用笔记 | 私密 |

#### 5.3.2 编辑器功能

- **Markdown 编辑**：基于 CodeMirror 6，支持 CommonMark + GFM
- **协作编辑**：基于 Yjs CRDT，多人同时编辑同一笔记无冲突
  - 光标与选区实时同步（Yjs Awareness 协议）
  - 每位协作者显示不同颜色标识
  - 离线编辑自动合并，冲突零丢失
- **双通道传输**：
  - 默认 WebSocket（经 Durable Object 中继），稳定可靠
  - 房间内 ≥2 人时自动尝试 WebRTC P2P 升级，降低延迟
  - WebRTC 断开时自动回退到 WebSocket
- **实时预览**：编辑区右侧实时渲染预览（本地分屏 + 协作者同步）
- **快捷键**：保存（Cmd/Ctrl+S）、加粗、斜体、代码块、链接等
- **图片上传**：粘贴或拖拽图片 → 上传 R2 → 插入 Markdown 图片语法
- **自动保存**：Yjs 更新实时同步到 DO，DO 定期持久化到 D1（每 5 秒防抖）

#### 5.3.3 发布与可见性

- `draft` → `published`：发布操作，生成公开可访问的 slug URL
- `published` → `draft`：取消发布，从公开页面移除，清除 KV 缓存
- 发布时自动生成 slug（基于标题），可手动修改

### 5.4 公开笔记浏览

#### 5.4.1 SSR 页面

| 路由 | 说明 | 缓存策略 |
|------|------|---------|
| `/` | 首页，最新发布笔记列表 | KV 缓存 5 分钟 |
| `/note/:slug` | 单篇笔记详情 | KV 缓存 10 分钟 |
| `/tag/:tag` | 标签筛选页 | KV 缓存 5 分钟 |
| `/category/:type` | 分类页 | KV 缓存 5 分钟 |

#### 5.4.2 SSR 渲染流程

1. 请求到达 Worker
2. 检查 KV 缓存，命中则直接返回 HTML
3. 未命中 → D1 查询笔记数据
4. comark 解析 Markdown → AST
5. remark/rehype 插件处理（GFM 表格、代码高亮、数学公式等）
6. Shiki 代码高亮（SSR 阶段完成）
7. 渲染为完整 HTML（含内联关键 CSS）
8. 写入 KV 缓存
9. 返回 HTML 响应

#### 5.4.3 笔记发布时缓存失效

```
Note Published / Updated
  → 删除 /note/:slug 对应 KV key
  → 删除首页列表 KV key
  → 删除关联标签页 KV key
  → 下次请求时重新 SSR 并缓存
```

### 5.5 协作编辑与实时预览

#### 5.5.1 协作编辑架构

```
                    ┌─────────────────────────────┐
                    │    CollaborationRoomDO       │
                    │  (Durable Object per note)   │
                    │                              │
                    │  ┌─────────────────────────┐ │
                    │  │   Yjs Doc (in-memory)   │ │
                    │  │   - Markdown content    │ │
                    │  │   - Awareness state     │ │
                    │  └────────┬────────────────┘ │
                    │           │                  │
                    │  ┌────────▼────────────────┐ │
                    │  │  y-websocket server     │ │
                    │  │  - 消息广播              │ │
                    │  │  - 增量更新持久化         │ │
                    │  │  - 新连接状态恢复         │ │
                    │  └────────┬────────────────┘ │
                    │           │                  │
                    │  ┌────────▼────────────────┐ │
                    │  │  WebRTC Signaling       │ │
                    │  │  - offer/answer/ice     │ │
                    │  │  - 房间管理              │ │
                    │  └─────────────────────────┘ │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         ┌────▼────┐    ┌─────▼────┐    ┌──────▼───┐
         │ Author A│    │ Author B │    │ Viewer C │
         │ (r/w)   │    │ (r/w)    │    │ (r/o)   │
         │ y-ws    │    │ y-ws+rtc │    │ y-ws    │
         └─────────┘    └──────────┘    └──────────┘
```

#### 5.5.2 协作流程

```
1. Author 打开笔记 → 创建 Yjs Doc → y-codemirror.next 绑定 CodeMirror 6
2. 通过 y-websocket 连接 CollaborationRoomDO（noteId 为房间 ID）
3. DO 从持久化存储恢复 Yjs 状态 → 同步给新加入者
4. 编辑操作 → Yjs 本地更新 → y-websocket 发送到 DO
5. DO 广播更新给房间内所有连接者
6. 房间内 ≥2 人时，前端自动尝试 y-webrtc P2P 升级
7. WebRTC 信令（offer/answer/ice-candidate）通过 DO 中转
8. P2P 建立后，Yjs 更新走 WebRTC 直连，WebSocket 降级为备份
9. 协作者光标/选区通过 Yjs Awareness 协议实时同步
10. 会话结束 → DO 将最终 Yjs 状态合并为 Markdown → 持久化到 D1
```

#### 5.5.3 Durable Object 设计

```typescript
// src/do/collaboration-room.do.ts
export class CollaborationRoomDO implements DurableObject {
  private ydoc: Y.Doc;                    // Yjs 文档实例
  private awareness: Map<number, object>;  // 协作者感知状态
  private connections = new Map<WebSocket, {
    role: 'editor' | 'viewer';
    userId: string;
  }>();

  // WebSocket 消息协议（y-websocket 兼容）
  // 客户端 → DO: Yjs sync step1/step2/update + Awareness update
  // DO → 客户端: 广播 Yjs update + Awareness update

  // WebRTC 信令协议
  // 客户端 → DO: { type: "signal", target: userId, signal: RTCSessionDescription/RTCIceCandidate }
  // DO → 客户端: { type: "signal", from: userId, signal: ... }

  // 持久化策略
  // - Yjs 增量更新实时写入 DO storage
  // - 每 5 秒防抖将完整文档状态合并为 Markdown 写入 D1
  // - DO 销毁前确保最终状态已持久化
}
```

#### 5.5.4 传输模式对比

| 场景 | 传输模式 | 说明 |
|------|---------|------|
| 单人编辑 | WebSocket only | 无需 P2P，DO 直接中继 |
| 2+ 人协作 | WebSocket + WebRTC | 自动尝试 P2P 升级，降低延迟 |
| 只读预览 | WebSocket only | 预览者不需要 P2P |
| 网络受限 | WebSocket fallback | WebRTC 连接失败时自动回退 |

#### 5.5.5 预览（协作的只读模式）

```
1. Editor 点击「分享预览」→ 创建 collab_session（D1）+ 生成 token
2. 返回预览 URL：/preview/:token
3. Viewer 打开 URL → 以 read-only 角色加入 CollaborationRoomDO
4. Viewer 的 CodeMirror 实例设为 readOnly
5. Viewer 接收 Yjs 更新，实时看到编辑内容
6. Viewer 不发送编辑操作，不参与 Awareness 广播
```

#### 5.5.6 安全与隔离

- 协作房间以 noteId 为单位，仅该笔记的 author 可邀请协作者
- 预览 token 为加密随机字符串（32 字节），不可猜测
- 预览会话默认 24 小时过期
- Viewer 连接不发送编辑操作，DO 层面校验并拒绝
- Yjs 更新在 DO 端做权限校验，非 editor 角色的更新被丢弃
- 会话过期后 Durable Object 自动销毁

- 预览 token 为加密随机字符串（32 字节），不可猜测
- 预览会话默认 24 小时过期
- 仅持有 token 者可查看，无 token 无法访问
- 会话过期后 Durable Object 自动销毁

### 5.6 评论系统

#### 5.6.1 两层审核模型

评论的公开可见性由**两层审核**控制，必须同时通过才能公开显示：

```
用户注册 → approval_status = pending
  │
  ├─ 管理员审批 → approval_status = approved
  │     │
  │     └─ 用户发表评论 → author_approved = pending
  │           │
  │           ├─ 笔记作者审核通过 → author_approved = 1 → 评论公开可见
  │           └─ 笔记作者拒绝 → author_approved = -1 → 仅评论者+作者可见
  │
  └─ 管理员未审批 → approval_status = pending
        │
        └─ 用户发表评论 → 仅自己可见（不进入作者审核队列）
```

#### 5.6.2 评论模型

- 评论挂在已发布笔记下，不支持嵌套回复（Phase 1）
- 所有登录用户均可发表评论（含未审批用户）
- 评论为纯文本，不支持 Markdown（保持简洁）
- 评论需登录后发表

#### 5.6.3 评论可见性规则

| 查看者 | 未审批用户的评论 | 已审批用户 + 作者未审 | 已审批用户 + 作者通过 | 管理员隐藏 |
|--------|----------------|---------------------|---------------------|-----------|
| 未登录访客 | 不可见 | 不可见 | 可见 | 不可见 |
| 评论者本人 | 可见 | 可见 | 可见 | 不可见 |
| 笔记作者 | 不可见 | 可见（可审核） | 可见 | 不可见 |
| 管理员 | 可见 | 可见 | 可见 | 可见（标记） |

#### 5.6.4 评论管理

| 操作 | 评论者 | 笔记作者 | 管理员 |
|------|--------|---------|--------|
| 发表评论 | ✅ | ✅ | ✅ |
| 删除自己的评论 | ✅ | ✅ | ✅ |
| 删除他人评论 | ❌ | ❌ | ✅ |
| 审核评论（通过/拒绝） | ❌ | ✅（自己笔记下的） | ✅ |
| 隐藏评论（不删除） | ❌ | ❌ | ✅ |

#### 5.6.5 评论展示

- 笔记详情页 SSR 时仅包含已通过双层审核的公开评论
- 评论按时间正序排列
- 每页 20 条，支持分页加载
- 笔记作者登录后，可看到自己笔记下待审核的评论（带"待审核"标记）
- 评论者本人可看到自己所有未隐藏的评论（含待审核，带"审核中"标记）
- 管理员隐藏的评论对普通用户不可见，对管理员显示"已隐藏"标记

#### 5.6.6 用户审批流程

```
新用户注册 → approval_status = pending
  │
  ├─ 管理员在后台「用户管理」页面看到待审批列表
  │     │
  │     ├─ 审批通过 → approval_status = approved
  │     │     └─ 用户已有评论自动进入作者审核队列
  │     │
  │     └─ 拒绝 → approval_status = rejected
  │           └─ 用户评论继续保持仅自己可见
  │
  └─ 管理员可随时修改审批状态
```

### 5.7 搜索

#### 5.7.1 实现方案

- **Phase 1**：D1 `LIKE` 查询 + 前端防抖，满足初期需求
- **Phase 2**（可选）：接入 Cloudflare Vectorize 做语义搜索

#### 5.7.2 搜索 API

```
GET /api/search?q=keyword&category=tip&tag=git&page=1&limit=20
```

---

## 6. API 设计

### 6.1 认证

```
POST /api/auth/passkey/register     # 注册 Passkey（需 Turnstile token）
POST /api/auth/passkey/verify       # Passkey 登录验证
POST /api/auth/magic-link/send      # 发送 Magic Link（需 Turnstile token）
GET  /api/auth/magic-link/verify    # 验证 Magic Link
POST /api/auth/logout               # 登出
GET  /api/auth/session              # 获取当前 Session（含角色、审批状态信息）
```

### 6.2 OOBE（开箱体验）

```
GET  /api/setup/status              # 检查是否需要 OOBE（有无 admin 用户）
POST /api/setup/admin               # OOBE：创建管理员账号
```

### 6.3 管理员 API

```
GET    /api/admin/users                      # 用户列表（含角色、审批状态）
PATCH  /api/admin/users/:id/role             # 修改用户角色（commenter ↔ author）
PATCH  /api/admin/users/:id/approval         # 审批用户（pending → approved / rejected）
GET    /api/admin/users/pending              # 待审批用户列表
GET    /api/admin/stats                      # 站点统计（笔记数、用户数、评论数）
DELETE /api/admin/comments/:id               # 删除评论
PATCH  /api/admin/comments/:id               # 隐藏/显示评论（admin_hidden）
GET    /api/admin/settings                   # 获取站点设置
PATCH  /api/admin/settings                   # 更新站点设置
```

### 6.4 笔记 CRUD

```
GET    /api/notes                    # 列表（分页、筛选）[author: 自己的笔记; admin: 全部]
POST   /api/notes                    # 创建（仅 author）
GET    /api/notes/:id                # 详情
PATCH  /api/notes/:id                # 更新（仅 author 本人）
DELETE /api/notes/:id                # 删除（仅 author 本人）
POST   /api/notes/:id/publish        # 发布（仅 author 本人）
POST   /api/notes/:id/unpublish      # 取消发布（仅 author 本人）
```

### 6.5 评论

```
GET    /api/notes/:noteId/comments            # 笔记评论列表（仅公开评论 + 本人评论）
POST   /api/notes/:noteId/comments            # 发表评论（需登录：author/commenter/admin）
DELETE /api/comments/:id                      # 删除自己的评论
```

### 6.5.1 笔记作者评论审核

```
GET    /api/notes/:noteId/comments/pending    # 待审核评论列表（仅笔记作者）
PATCH  /api/comments/:id/approve              # 审核通过（仅笔记作者）
PATCH  /api/comments/:id/reject               # 审核拒绝（仅笔记作者）
```

### 6.6 标签

```
GET    /api/tags                     # 所有标签
POST   /api/tags                     # 创建标签（仅 admin）
DELETE /api/tags/:id                 # 删除标签（仅 admin）
```

### 6.7 附件

```
POST   /api/attachments/upload       # 上传图片/文件 → R2
DELETE /api/attachments/:id          # 删除附件
GET    /api/attachments/:id          # 获取附件信息
```

### 6.8 协作与预览

```
POST   /api/collab/rooms/:noteId             # 创建/加入协作房间（返回 WebSocket URL）
GET    /api/collab/rooms/:noteId/info         # 房间信息（在线人数、协作者列表）
DELETE /api/collab/rooms/:noteId              # 关闭协作房间

POST   /api/collab/preview/:noteId            # 创建预览 token（只读模式）
DELETE /api/collab/preview/:token             # 关闭预览会话
GET    /preview/:token                        # 预览页面（SSR）

WS     /api/collab/ws/:noteId                 # WebSocket 连接（y-websocket 协议）
WS     /api/collab/ws/:noteId?role=viewer     # WebSocket 连接（只读模式）
```

### 6.9 搜索

```
GET    /api/search?q=&category=&tag=&page=&limit=
```

---

## 7. 项目结构

```
murmur/
├── src/
│   ├── index.ts                    # Hono 入口，路由注册
│   ├── app.ts                      # Hono app 实例与中间件
│   │
│   ├── routes/                     # 路由定义
│   │   ├── ssr.ts                  # 公开页面 SSR 路由
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
│   ├── services/                   # 业务逻辑
│   │   ├── note.service.ts
│   │   ├── comment.service.ts
│   │   ├── tag.service.ts
│   │   ├── attachment.service.ts
│   │   ├── preview.service.ts
│   │   ├── search.service.ts
│   │   ├── user.service.ts         # 用户角色管理
│   │   ├── setup.service.ts        # OOBE 初始化逻辑
│   │   └── render.service.ts       # Markdown → HTML 渲染
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
│   │       └── user.repo.ts
│   │
│   ├── do/                         # Durable Objects
│   │   ├── collaboration-room.do.ts # 协作房间 DO（Yjs + WebSocket + WebRTC 信令）
│   │   └── rate-limiter.do.ts       # 限流 DO（评论/注册/登录）
│   │
│   ├── auth/                       # 认证配置
│   │   ├── better-auth.config.ts
│   │   ├── middleware.ts           # 认证守卫中间件
│   │   ├── rbac.ts                 # 角色权限校验（requireRole / requireAdmin）
│   │   └── turnstile.ts            # Turnstile 人机验证
│   │
│   ├── ssr/                        # SSR 渲染
│   │   ├── renderer.tsx            # HTML 壳 & 渲染器
│   │   ├── components/             # SSR 共用组件
│   │   └── pages/                  # 页面模板
│   │       ├── home.tsx
│   │       ├── note-detail.tsx     # 笔记详情（含评论区）
│   │       └── tag-list.tsx
│   │
│   ├── client/                     # 客户端 SPA（管理后台）
│   │   ├── main.tsx                # React 入口
│   │   ├── app.tsx                 # 路由 & 布局
│   │   ├── pages/
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
│   │   │   ├── ui/                 # shadcn/ui 组件（按需引入）
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── ...
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
│   │   │   ├── editor-store.ts     # 编辑器状态（当前笔记、Yjs 连接状态、侧边栏）
│   │   │   ├── ui-store.ts         # UI 状态（主题、侧边栏开关）
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
│   │   │   ├── useCollab.ts             # 协作编辑 Hook（Yjs + WebSocket/WebRTC）
│   │   │   ├── usePreview.ts            # 实时预览 Hook
│   │   │   ├── useAuth.ts
│   │   │   └── useRole.ts               # 角色权限 Hook
│   │   └── lib/                    # 客户端工具
│   │       ├── api.ts              # Hono RPC 客户端封装
│   │       ├── cn.ts               # clsx + tailwind-merge 工具函数
│   │       └── format.ts           # 日期/金额格式化
│   │
│   └── shared/                     # 前后端共享
│       ├── types.ts                # TypeScript 类型
│       ├── constants.ts            # 常量定义
│       ├── rbac.ts                 # 角色定义与权限常量
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
├── components.json                 # shadcn/ui 配置
├── wrangler.toml                   # Cloudflare Workers 配置
├── wrangler.dev.toml               # 本地开发配置覆盖
├── package.json
├── tsconfig.json
├── vite.config.ts                  # 客户端构建
└── README.md
```

---

## 8. 关键技术实现

### 8.1 SSR 渲染管线

```typescript
// src/services/render.service.ts
import { unified } from 'unified';
import { comark } from 'comark';           // CommonMark 解析
import remarkGfm from 'remark-gfm';        // GFM 扩展
import remarkMath from 'remark-math';       // 数学公式
import rehypeShiki from 'rehype-shiki';     // 代码高亮
import rehypeStringify from 'rehype-stringify';

const pipeline = unified()
  .use(comark)                    // Markdown → MDAST
  .use(remarkGfm)                 // GFM 支持（表格、删除线等）
  .use(remarkMath)                // 数学公式支持
  .use(rehypeShiki, { theme: 'github-dark' })  // 代码高亮
  .use(rehypeStringify);          // HAST → HTML

export async function renderMarkdown(content: string): Promise<string> {
  const result = await pipeline.process(content);
  return String(result);
}
```

### 8.2 KV 缓存策略

```typescript
// 缓存 key 设计
const cacheKeys = {
  home:          'page:home',
  noteDetail:    (slug: string) => `page:note:${slug}`,
  tagPage:       (tag: string) => `page:tag:${tag}`,
  categoryPage:  (cat: string) => `page:category:${cat}`,
};

// 缓存失效：笔记发布/更新时
async function invalidateNoteCache(slug: string, tags: string[], category: string) {
  await Promise.all([
    env.KV.delete(cacheKeys.home),
    env.KV.delete(cacheKeys.noteDetail(slug)),
    ...tags.map(t => env.KV.delete(cacheKeys.tagPage(t))),
    env.KV.delete(cacheKeys.categoryPage(category)),
  ]);
}
```

### 8.3 CollaborationRoomDO（协作房间 + 实时预览）

```typescript
// src/do/collaboration-room.do.ts
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

export class CollaborationRoomDO implements DurableObject {
  private ydoc = new Y.Doc();
  private connections = new Map<WebSocket, {
    role: 'editor' | 'viewer';
    userId: string;
  }>();
  private lastPersist = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { 0: client, 1: server } = new WebSocketPair();

    // 从 URL 参数或 cookie 中提取用户信息和角色
    const role = url.searchParams.get('role') as 'editor' | 'viewer';
    const userId = url.searchParams.get('userId') || '';

    server.accept();
    this.connections.set(server, { role, userId });

    // y-websocket 协议：同步 Yjs 文档状态
    // 新连接 → 发送当前文档状态 → 接收后续增量更新
    setupWSConnection(this.ydoc, server);

    // WebRTC 信令中转
    server.addEventListener('message', (event) => {
      const data = JSON.parse(event.data as string);

      // 信令消息转发给目标用户
      if (data.type === 'signal' && data.target) {
        for (const [ws, info] of this.connections) {
          if (info.userId === data.target && ws !== server) {
            ws.send(JSON.stringify({
              type: 'signal',
              from: userId,
              signal: data.signal,
            }));
          }
        }
        return;
      }

      // 权限校验：viewer 不允许发送编辑操作
      if (role === 'viewer' && data.type === 'update') {
        return; // 丢弃 viewer 的编辑操作
      }
    });

    // Awareness：广播协作者加入/离开
    this.broadcastAwareness();

    server.addEventListener('close', () => {
      this.connections.delete(server);
      this.broadcastAwareness();
      // 无连接时延迟持久化并销毁
      if (this.connections.size === 0) {
        this.schedulePersistAndDestroy();
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // 广播协作者在线状态
  private broadcastAwareness() {
    const users = Array.from(this.connections.values()).map(c => ({
      userId: c.userId,
      role: c.role,
    }));
    const msg = JSON.stringify({ type: 'awareness', users });
    for (const ws of this.connections.keys()) {
      ws.send(msg);
    }
  }

  // 防抖持久化：5 秒内合并更新写入 D1
  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistToD1(), 5000);
  }

  // 将 Yjs 文档状态转为 Markdown 并写入 D1
  private async persistToD1() {
    const content = this.ydoc.getText('content').toString();
    const title = this.ydoc.getText('title').toString();
    // 调用 D1 更新笔记
    // await this.env.DB.prepare('UPDATE notes SET content = ?, title = ? WHERE id = ?')
    //   .bind(content, title, noteId).run();
  }
}
```

### 8.4 better-auth 配置（含角色扩展）

```typescript
// src/auth/better-auth.config.ts
import { betterAuth } from 'better-auth';
import { passkey } from 'better-auth/plugins/passkey';
import { d1 } from 'better-auth/adapters/d1';

export function createAuth(env: Env) {
  return betterAuth({
    database: d1(env.DB),
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'commenter',
          input: false,       // 注册时不可设置，由系统控制
        },
        approvalStatus: {
          type: 'string',
          defaultValue: 'pending',
          input: false,       // 注册时不可设置，由管理员控制
          fieldName: 'approval_status',
        },
      },
    },
    plugins: [
      passkey({
        rpID: env.RP_ID,
        rpName: 'Murmur',
        origin: env.ORIGIN,
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 天
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
  });
}
```

### 8.5 RBAC 中间件

```typescript
// src/auth/rbac.ts
import { createMiddleware } from 'hono/factory';

type Role = 'admin' | 'author' | 'commenter';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 3,
  author: 2,
  commenter: 1,
};

// 要求最低角色
export function requireRole(minRole: Role) {
  return createMiddleware(async (c, next) => {
    const session = c.get('session');
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    const userRole = session.user.role as Role;
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await next();
  });
}

// 仅管理员
export const requireAdmin = requireRole('admin');

// 笔记作者及以上
export const requireAuthor = requireRole('author');

// 任意已登录用户（含评论者）
export const requireAuth = requireRole('commenter');
```

### 8.6 OOBE 初始化流程

```typescript
// src/services/setup.service.ts
import { eq, count } from 'drizzle-orm';
import { users } from '../db/schema';
import type { Database } from '../db/client';

export async function needsSetup(db: Database): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.role, 'admin'));
  return (result?.count ?? 0) === 0;
}

export async function createInitialAdmin(
  db: Database,
   { email: string; name: string }
): Promise<void> {
  // 二次校验：防止并发创建
  if (!(await needsSetup(db))) {
    throw new Error('Setup already completed');
  }

  // 通过 better-auth 注册用户，然后直接将 role 更新为 admin
  await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.email, data.email));
}
```

### 8.7 评论服务（双层审核）

```typescript
// src/services/comment.service.ts
import { eq, and, or, asc } from 'drizzle-orm';
import { comments, users } from '../db/schema';
import type { Database } from '../db/client';

export class CommentService {
  constructor(private db: Database) {}

  async create(noteId: string, authorId: string, content: string) {
    const now = new Date().toISOString();
    return this.db.insert(comments).values({
      id: nanoid(),
      noteId,
      authorId,
      content,
      authorApproved: 0,  // pending
      adminHidden: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 公开评论列表：双层审核通过 + 未隐藏
  async listPublic(noteId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorName: users.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(and(
        eq(comments.noteId, noteId),
        eq(comments.authorApproved, 1),
        eq(comments.adminHidden, 0),
        eq(users.approvalStatus, 'approved'),
      ))
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  // 笔记作者视角：看到已审批用户的所有评论（含待审核）
  async listForAuthor(noteId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorApproved: comments.authorApproved,
        authorName: users.name,
        authorApprovalStatus: users.approvalStatus,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(and(
        eq(comments.noteId, noteId),
        eq(comments.adminHidden, 0),
        eq(users.approvalStatus, 'approved'),
      ))
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  // 评论者本人视角：看到自己所有未隐藏的评论（含待审核）
  async listForSelf(noteId: string, userId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorApproved: comments.authorApproved,
        authorName: users.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(and(
        eq(comments.noteId, noteId),
        eq(comments.adminHidden, 0),
        or(eq(comments.authorApproved, 1), eq(comments.authorId, userId)),
      ))
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  // 笔记作者审核评论
  async approveByAuthor(commentId: string) {
    return this.db
      .update(comments)
      .set({ authorApproved: 1, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId));
  }

  async rejectByAuthor(commentId: string) {
    return this.db
      .update(comments)
      .set({ authorApproved: -1, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId));
  }

  // 管理员隐藏评论
  async hideByAdmin(commentId: string) {
    return this.db
      .update(comments)
      .set({ adminHidden: 1, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId));
  }
}
```

---

## 9. 前端工程化

### 9.1 Tailwind CSS v4 + shadcn/ui

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/client/**/*.{ts,tsx}', './src/ssr/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌色系
        brand: {
          50:  '#f0f4ff',
          100: '#dbe4ff',
          500: '#4c6ef5',
          600: '#3b5bdb',
          700: '#364fc7',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],     // 英文
        mono: ['SF Pro Text', 'Menlo', 'monospace'],       // 数字/代码
      },
    },
  },
  plugins: [],
} satisfies Config;
```

```json
// components.json (shadcn/ui 配置)
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/client/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui"
  }
}
```

### 9.2 状态管理分层

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                       │
├──────────────────┬──────────────────────────────────────┤
│   Zustand        │         TanStack Query                │
│   (客户端状态)    │         (服务端状态)                   │
├──────────────────┼──────────────────────────────────────┤
│ • 编辑器状态      │ • 笔记列表（缓存 + 分页）              │
│ • 侧边栏开关      │ • 笔记详情（乐观更新）                 │
│ • 当前笔记 ID     │ • 评论列表（乐观更新）                 │
│ • 协作连接状态    │ • 用户列表（admin）                    │
│ • 光标颜色映射    │ • 标签列表                            │
│ • 主题偏好        │ • 认证状态                            │
├──────────────────┴──────────────────────────────────────┤
│              Hono RPC Client (API 调用)                   │
└─────────────────────────────────────────────────────────┘
```

```typescript
// src/client/stores/editor-store.ts
import { create } from 'zustand';

interface EditorState {
  currentNoteId: string | null;
  isCollabConnected: boolean;
  sidebarOpen: boolean;
  setCurrentNote: (id: string) => void;
  setCollabConnected: (connected: boolean) => void;
  toggleSidebar: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentNoteId: null,
  isCollabConnected: false,
  sidebarOpen: true,
  setCurrentNote: (id) => set({ currentNoteId: id }),
  setCollabConnected: (connected) => set({ isCollabConnected: connected }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

```typescript
// src/client/queries/notes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useNotes(category?: string) {
  return useQuery({
    queryKey: ['notes', { category }],
    queryFn: () => api.notes.list({ category }),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNoteInput) => api.notes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
```

### 9.3 Zod Schema 前后端共享

```typescript
// src/shared/schemas/comment.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000, '评论不超过 2000 字符'),
  noteId: z.string(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// 前端：React Hook Form 校验
// const form = useForm({ resolver: zodResolver(createCommentSchema) });

// 后端：Hono 路由校验
// app.post('/api/notes/:noteId/comments', zValidator('json', createCommentSchema), handler);
```

---

## 10. Wrangler 配置 (基础设施)

```toml
# wrangler.toml
name = "murmur"
main = "src/index.ts"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
RP_ID = "murmur.example.com"
ORIGIN = "https://murmur.example.com"
TURNSTILE_SITE_KEY = "<your-turnstile-site-key>"

# Turnstile 密钥（Secret，不写在配置文件中）
# wrangler secret put TURNSTILE_SECRET_KEY

# D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "murmur-db"
database_id = "<your-database-id>"

# KV 命名空间（SSR 缓存）
[[kv_namespaces]]
binding = "KV"
id = "<your-kv-namespace-id>"

# R2 存储桶（附件）
[[r2_buckets]]
binding = "R2"
bucket_name = "murmur-assets"

# Durable Objects（协作编辑 + 实时预览 + 限流）
[durable_objects]
bindings = [
  { name = "COLLAB_DO", class_name = "CollaborationRoomDO" },
  { name = "RATE_LIMITER_DO", class_name = "RateLimiterDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["CollaborationRoomDO", "RateLimiterDO"]
```

---

## 11. 开发计划

### Phase 1：基础骨架（Week 1-2）

- [ ] 项目初始化：Hono + Vite + TypeScript + Wrangler
- [ ] Tailwind CSS v4 + shadcn/ui 配置与基础组件引入
- [ ] Zustand + TanStack Query 状态管理层搭建
- [ ] D1 数据库建表与迁移（Drizzle ORM schema 定义 + drizzle-kit generate）
- [ ] better-auth 集成（WebAuthn Passkey + role/approval_status 扩展字段）
- [ ] OOBE 初始化流程（检测无 admin → 引导创建）
- [ ] RBAC 中间件（requireRole / requireAdmin / requireAuthor）
- [ ] 基础 CRUD API（笔记创建、编辑、删除，含 author_id）
- [ ] CodeMirror 6 编辑器集成
- [ ] comark Markdown 渲染管线

### Phase 2：核心功能（Week 3-4）

- [ ] 笔记发布/取消发布
- [ ] 标签系统
- [ ] 图片上传（R2）
- [ ] 评论系统（双层审核：用户审批 + 作者审核，React Hook Form + Zod 校验）
- [ ] 管理员后台：用户角色管理 + 用户审批（pending/approved/rejected）
- [ ] 管理员后台：评论管理（隐藏/显示）
- [ ] 笔记作者：评论审核（通过/拒绝）
- [ ] SSR 公开页面（首页、笔记详情、标签页、评论展示）
- [ ] KV 缓存与失效
- [ ] 自动保存

### Phase 3：协作编辑与实时预览（Week 5-7）

- [ ] Yjs + y-codemirror.next 集成
- [ ] CollaborationRoomDO 实现（Yjs 文档状态 + WebSocket 中继）
- [ ] y-websocket 客户端连接与同步
- [ ] 协作者光标与 Awareness 协议
- [ ] WebRTC P2P 传输（y-webrtc + DO 信令）
- [ ] WebSocket/WebRTC 自动切换与回退
- [ ] 只读预览模式（viewer 角色）
- [ ] DO 持久化：Yjs 状态 → D1 Markdown 同步
- [ ] 预览 token 生成与过期机制

### Phase 4：打磨上线（Week 8-9）

- [ ] 搜索功能（D1 LIKE 查询）
- [ ] SEO 优化（meta、OG 标签、sitemap）
- [ ] 暗色模式
- [ ] 移动端适配
- [ ] 性能优化（SSR 缓存命中率、Yjs 增量更新大小优化）
- [ ] 自定义域名绑定
- [ ] 部署上线

---

## 12. 环境变量与密钥

| 变量 | 说明 | 存储位置 |
|------|------|---------|
| `RP_ID` | WebAuthn Relying Party ID | wrangler.toml vars |
| `ORIGIN` | 站点完整 URL | wrangler.toml vars |
| `BETTER_AUTH_SECRET` | Auth 加密密钥 | Wrangler Secrets |
| `BETTER_AUTH_URL` | Auth 回调 URL | wrangler.toml vars |
| `R2_PUBLIC_URL` | R2 公开访问域名 | wrangler.toml vars |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 服务端密钥 | Wrangler Secrets |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile 前端 Site Key | wrangler.toml vars |
| `ADMIN_EMAIL` | OOBE 管理员邮箱白名单（可选） | Wrangler Secrets |

---

## 13. 技术风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| D1 冷启动延迟 | 首次请求慢 | KV 缓存覆盖热路径；D1 首次查询后保持连接 |
| comark 在 Workers 中运行兼容性 | 渲染失败 | 备选方案：remark-parse 替代 comark |
| Yjs 在 Durable Objects 中内存占用 | 大文档多协作者时内存高 | 限制单文档最大 1MB；DO 空闲 30 秒后持久化并释放内存 |
| WebRTC NAT 穿透失败 | P2P 连接无法建立 | 自动回退到 WebSocket 中继，用户无感知 |
| Yjs 增量更新丢失 | 协作编辑内容丢失 | DO 持久化 Yjs 状态到 storage；WebSocket 断连重连时自动同步 |
| better-auth 与 D1 兼容性 | 认证失败 | better-auth 官方支持 D1 adapter，风险低 |
| WebAuthn 跨设备问题 | 用户无法登录 | 提供 Email Magic Link 作为备用 |
| OOBE 并发竞争 | 多人同时创建 admin | 使用 D1 事务 + 二次校验防止重复创建 |
| 角色提升提权风险 | 非法获取 author/admin 权限 | RBAC 中间件在每次请求校验角色，不信任客户端传入 |
| 评论滥用 | 垃圾评论、恶意内容 | 双层审核（用户审批 + 作者审核）+ 管理员隐藏机制 |
| 协作房间权限泄露 | 非授权用户编辑笔记 | DO 校验每个连接的角色，viewer 的编辑操作被丢弃 |
| 机器人注册 | 批量创建垃圾账号 | Cloudflare Turnstile 人机验证 + Rate Limiter 限流 |
| API 滥用 | 暴力请求耗尽资源 | Cloudflare Rate Limiting Rules + DO 滑动窗口限流 |
| shadcn/ui 组件体积 | 按需引入失控导致 bundle 膨胀 | 定期 `npx vite-bundle-visualizer` 审计；仅引入使用的组件 |
| Tailwind 类名冲突 | SSR 与 SPA 样式不一致 | Tailwind v4 content 扫描覆盖 SSR + SPA 路径；CI 中运行样式一致性检查 |

---

## 14. 补充约定

### 14.1 SSR 与 SPA 路由边界

```
/ (公开)               → SSR (hono/jsx 渲染 HTML)
/note/:slug (公开)     → SSR
/tag/:tag (公开)       → SSR
/preview/:token (公开) → SSR + WebSocket hydration

/admin/* (后台)        → SPA (Vite 构建的 React 应用)
/login                 → SPA 路由
/setup                 → SPA 路由
```

- 公开页面由 Worker 直接 SSR 渲染，客户端仅做轻量交互（评论提交等）
- 管理后台是完整的 React SPA，通过 Vite 构建为静态资源，Worker 返回 `index.html`
- 两套应用共存于同一 Worker，Hono 路由按路径前缀分流

### 14.2 错误响应格式

所有 API 返回统一 JSON 格式：

```typescript
// 成功
{ "data": T }

// 错误
{ "error": { "code": "VALIDATION_ERROR", "message": "评论内容不能为空", "details?: ZodIssue[] } }

// HTTP 状态码约定
// 400 - 请求校验失败（Zod 校验错误）
// 401 - 未登录
// 403 - 权限不足（角色不符 / 用户未审批）
// 404 - 资源不存在
// 409 - 冲突（slug 重复、OOBE 已完成等）
// 429 - 限流
// 500 - 服务端错误
```

### 14.3 附件 URL 策略

- R2 桶设为私有，不公开访问
- 附件通过 Worker 代理路由提供：`GET /api/attachments/:id/file`
- Worker 从 D1 查询 `r2_key`，从 R2 读取后流式返回，附带 `Cache-Control: public, max-age=31536000, immutable`
- 上传时生成 `r2_key = attachments/{noteId}/{nanoid}.{ext}`

### 14.4 Email Magic Link

- 邮件发送：Cloudflare Email Workers（接收）+ Resend API（发送）
- Token：`nanoid(32)`，存入 D1 `verifications` 表，15 分钟过期
- 链接格式：`{ORIGIN}/api/auth/magic-link/verify?token={token}`
- 点击后验证 token，创建 session，重定向到 `/admin`

### 14.5 管理员站点设置

站点设置存储在 KV 中（非 D1），key 前缀 `settings:`：

```
settings:site_name       → 站点名称（默认 "Murmur"）
settings:site_desc       → 站点描述
settings:posts_per_page  → 每页笔记数（默认 20）
settings:comments_per_page → 每页评论数（默认 20）
settings:allow_registration → 是否开放注册（默认 true）
```

### 14.6 测试策略

| 层级 | 框架 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | Service 层、Repository 层、Zod Schema |
| 集成测试 | Vitest + Miniflare | API 路由（含 RBAC 中间件）、Drizzle 查询 |
| E2E 测试 | Playwright | 登录流程、笔记 CRUD、评论审核、协作编辑 |
| 类型检查 | tsc --noEmit | CI 中运行，零 any |

### 14.7 CI/CD

- **CI**：GitHub Actions — lint + typecheck + test + build
- **CD**：`wrangler deploy`，main 分支合并后自动部署
- **Preview**：PR 自动创建 Cloudflare Preview 环境
