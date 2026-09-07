// packages/db/src/schema.ts

import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
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
