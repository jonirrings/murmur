import { count, desc, eq, inArray, type SQL } from "drizzle-orm";
import db from "../db";
import { snippets, tags, snippetsToTags } from "../db/schema";

export type TagRow = typeof tags.$inferSelect;
export type SnippetRow = typeof snippets.$inferSelect;

/** 从标题生成 URL 友好 slug；纯中文标题会退化为 snippet-<时间戳> */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `snippet-${Date.now().toString(36)}`;
}

/** 去掉 Markdown 标记后取前 max 个字符作为摘要 */
export function makeExcerpt(md: string, max = 200): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[#>*_~`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

/** 确保 slug 唯一（冲突时追加 -2 / -3 ...） */
export async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  let slug = base;
  let n = 2;
  for (;;) {
    const existing = await db
      .select({ id: snippets.id })
      .from(snippets)
      .where(eq(snippets.slug, slug))
      .all();
    const conflict = existing.some((r) => r.id !== excludeId);
    if (!conflict) return slug;
    slug = `${base}-${n++}`;
  }
}

/** 一次查询拿到多个 snippet 的 tags，返回 snippetId -> tags 的映射 */
export async function getTagsForSnippets(snippetIds: number[]): Promise<Map<number, TagRow[]>> {
  const map = new Map<number, TagRow[]>();
  if (snippetIds.length === 0) return map;

  const rows = await db
    .select({ snippetId: snippetsToTags.snippetId, tag: tags })
    .from(snippetsToTags)
    .innerJoin(tags, eq(snippetsToTags.tagId, tags.id))
    .where(inArray(snippetsToTags.snippetId, snippetIds))
    .all();

  for (const row of rows) {
    const list = map.get(row.snippetId) ?? [];
    list.push(row.tag);
    map.set(row.snippetId, list);
  }
  return map;
}

/** 分页查询 snippets（含每个的 tags），返回 PaginatedResponse 结构 */
export async function querySnippets(opts: {
  where?: SQL | undefined;
  page?: number;
  pageSize?: number;
}) {
  const { where, page = 1, pageSize = 10 } = opts;

  const rowsQuery = db.select().from(snippets).$dynamic();
  if (where) rowsQuery.where(where);
  rowsQuery
    .orderBy(desc(snippets.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countQuery = db.select({ value: count() }).from(snippets).$dynamic();
  if (where) countQuery.where(where);

  const [rows, totalRows] = await Promise.all([rowsQuery.all(), countQuery.all()]);
  const tagsMap = await getTagsForSnippets(rows.map((r) => r.id));
  const items = rows.map((r) => ({ ...r, tags: tagsMap.get(r.id) ?? [] }));
  const total = totalRows[0]?.value ?? 0;

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/** 替换某个 snippet 的标签关联（先清空再写入） */
export async function replaceSnippetTags(snippetId: number, tagIds: number[]): Promise<void> {
  await db.delete(snippetsToTags).where(eq(snippetsToTags.snippetId, snippetId));
  if (tagIds.length === 0) return;
  await db.insert(snippetsToTags).values(tagIds.map((tagId) => ({ snippetId, tagId })));
}

/** 查询单个 snippet 的标签 */
export async function getSnippetTags(snippetId: number): Promise<TagRow[]> {
  const rows = await db
    .select({ tag: tags })
    .from(snippetsToTags)
    .innerJoin(tags, eq(snippetsToTags.tagId, tags.id))
    .where(eq(snippetsToTags.snippetId, snippetId))
    .all();
  return rows.map((r) => r.tag);
}
