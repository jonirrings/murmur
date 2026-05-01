import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ─── better-auth core tables ───
// better-auth expects: user, session, account, verification
// We define them here so Drizzle migrations manage all tables.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  // Murmur extensions
  role: text("role", {
    enum: ["admin", "author", "commenter"],
  })
    .notNull()
    .default("commenter"),
  approvalStatus: text("approval_status", {
    enum: ["pending", "approved", "rejected"],
  })
    .notNull()
    .default("pending"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: text("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: text("access_token_expires_at"),
  refreshTokenExpiresAt: text("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── 笔记 ───
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    slug: text("slug").unique(),
    category: text("category", {
      enum: ["note", "inspiration", "tip", "knowledge"],
    })
      .notNull()
      .default("note"),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    wordCount: integer("word_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    publishedAt: text("published_at"),
  },
  (table) => [
    index("idx_notes_status").on(table.status),
    index("idx_notes_category").on(table.category),
    index("idx_notes_author_id").on(table.authorId),
    index("idx_notes_updated_at").on(table.updatedAt),
  ],
);

// ─── 标签 ───
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
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
  id: text("id").primaryKey(),
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
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    content: text("content").notNull(),
    authorApproved: integer("author_approved").notNull().default(0),
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
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  token: text("token").unique(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});
