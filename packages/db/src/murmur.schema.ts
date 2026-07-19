// packages/db/src/schema.ts

import { sql } from "drizzle-orm";
import {integer, primaryKey, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

// ─── 碎片 ───
export const snippets = sqliteTable("snippets", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull(),       // Markdown 正文（唯一源）
    excerpt: text("excerpt"),                       // 自动生成：取前 200 字符
    language: text("language"),                      // 关联的语言/技术（可选，用于徽标）
    coverImage: text("cover_image"),                // R2 对象键
    status: text("status", { enum: ["draft", "published", "archived"] })
        .default("draft").notNull(),
    visibility: text("visibility", { enum: ["public", "unlisted", "private"] })
        .default("public").notNull(),

    authorId: text("author_id").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
    updatedAt: text("updated_at").default(sql`(current_timestamp)`),
});

// ─── 标签 ───
export const tags = sqliteTable("tags", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),                          // Tailwind 颜色类名
    createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// ─── 碎片-标签 多对多 ───
export const snippetsToTags = sqliteTable("snippets_to_tags", {
    snippetId: integer("snippet_id").notNull()
        .references(() => snippets.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull()
        .references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
    pk: primaryKey({ columns: [t.snippetId, t.tagId] }),
}));

// ─── 媒体 ───
export const media = sqliteTable("media", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    r2Key: text("r2_key").notNull(),
    alt: text("alt"),
    uploadedBy: text("uploaded_by"),
    createdAt: text("created_at").default(sql`(current_timestamp)`),
});

// 内存优先，D1 作为跨 isolate 的补充持久层
export const rateLimits = sqliteTable("rate_limits", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),          // ip:endpoint
    count: integer("count").default(1),
    resetAt: integer("reset_at").notNull(), // unix timestamp ms
    createdAt: text("created_at").default(sql`(current_timestamp)`),
}, (t) => ({
    keyIdx: index("rate_limits_key_idx").on(t.key, t.resetAt),
}));

// 定期清理过期条目（通过 Worker Cron Trigger 或请求时惰性清理）