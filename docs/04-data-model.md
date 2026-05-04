## 4. 数据模型

### 4.1 Drizzle Schema（Single Source of Truth）

Schema 定义在 TypeScript 中，由 `drizzle-kit generate` 自动生成 D1 迁移 SQL。

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── better-auth 扩展字段 ───
// better-auth 自动创建 users/sessions/accounts/webauthn_credentials 表
// 以下通过 better-auth additionalFields + Drizzle 迁移脚本添加扩展列

// ─── 笔记 ───
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(), // crypto.randomUUID()
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""), // Markdown 原文
    excerpt: text("excerpt").notNull().default(""), // 自动提取前 200 字
    slug: text("slug").unique(), // URL 友好标识
    category: text("category", { enum: ["note", "inspiration", "tip", "knowledge"] })
      .notNull()
      .default("note"),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    wordCount: integer("word_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0), // 阅读量（反爬虫 + CF Analytics 校准）
    createdAt: text("created_at").notNull(), // ISO 8601
    updatedAt: text("updated_at").notNull(),
    publishedAt: text("published_at"), // nullable
  },
  (table) => [
    index("idx_notes_status").on(table.status),
    index("idx_notes_category").on(table.category),
    index("idx_notes_author_id").on(table.authorId),
    index("idx_notes_updated_at").on(table.updatedAt),
    index("idx_notes_slug").on(table.slug),
  ],
);

// ─── 标签 ───
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

// ─── 笔记-标签关联 ───
export const noteTags = sqliteTable(
  "note_tags",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [index("idx_note_tags_tag_id").on(table.tagId)],
);

// ─── 附件 ───
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
  r2Key: text("r2_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── 评论 ───
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(), // crypto.randomUUID()
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(), // 纯文本
    authorApproved: integer("author_approved").notNull().default(0), // 0=pending/not-approved, 1=approved
    adminHidden: integer("admin_hidden").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_comments_note_id").on(table.noteId, table.createdAt),
    index("idx_comments_author_id").on(table.authorId),
    index("idx_comments_pending").on(table.noteId, table.authorApproved),
  ],
);

// ─── 协作会话 ───
export const collabSessions = sqliteTable("collab_sessions", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").references(() => user.id, { onDelete: "set null" }),
  role: text("role", { enum: ["editor", "viewer"] })
    .notNull()
    .default("editor"),
  token: text("token").unique(), // 只读预览令牌
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

// ─── better-auth 用户表（扩展字段） ───
// better-auth 自动管理 users 表核心字段
// 以下通过迁移脚本添加扩展列
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  role: text("role", { enum: ["admin", "author", "commenter"] })
    .notNull()
    .default("commenter"),
  approvalStatus: text("approval_status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  banned: integer("banned", { mode: "boolean" }).default(false), // better-auth admin 插件
  banReason: text("ban_reason"), // better-auth admin 插件
  banExpires: text("ban_expires"), // better-auth admin 插件
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

**迁移流程**：

```bash
# 1. 修改 src/db/schema.ts 后，自动生成迁移 SQL
pnpm drizzle-kit generate

# 2. 应用迁移到本地 D1
pnpm wrangler d1 migrations apply murmur-db --local

# 3. 应用迁移到远程 D1
pnpm wrangler d1 migrations apply murmur-db --remote
```

**Drizzle + D1 初始化**：

```typescript
// src/db/client.ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

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
                         + banned INTEGER DEFAULT 0                     (admin 插件)
                         + ban_reason TEXT                              (admin 插件)
                         + ban_expires TEXT                             (admin 插件)
                         + two_factor_enabled INTEGER                   (twoFactor 插件)
sessions               -- id, user_id, token, expires_at
                         + impersonated_by TEXT                         (admin 插件)
accounts               -- id, user_id, provider_id, provider_account_id
passkey                -- id, name, public_key, user_id, credential_id, counter, device_type, backed_up, transports, created_at, aaguid
                         (@better-auth/passkey 自动管理)
two_factor             -- id, user_id, secret, backup_codes, verified_at
                         (better-auth twoFactor 插件自动管理)
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

| 查看者     | 未审核用户的评论 | 已审核用户 + 作者未审 | 已审核用户 + 作者通过 | 管理员隐藏   |
| ---------- | ---------------- | --------------------- | --------------------- | ------------ |
| 普通访客   | 不可见           | 不可见                | 可见                  | 不可见       |
| 评论者本人 | 可见             | 可见                  | 可见                  | 不可见       |
| 笔记作者   | 不可见           | 可见（可审核）        | 可见                  | 不可见       |
| 管理员     | 可见             | 可见                  | 可见                  | 可见（标记） |

---
