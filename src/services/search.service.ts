import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { notes, noteTags, tags } from "@/db/schema";
import { eq, and, like, or, desc } from "drizzle-orm";

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  slug: string | null;
  category: string;
  wordCount: number;
  publishedAt: string | null;
  createdAt: string;
  authorName: string | null;
}

interface SearchResults {
  items: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

export class SearchService {
  constructor(private db: Database) {}

  async search(params: {
    query: string;
    category?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }): Promise<SearchResults> {
    const { query, category, tag, page = 1, limit = 20 } = params;

    const conditions = [eq(notes.status, "published")];

    // Full-text search on title and content using LIKE
    const searchTerm = `%${query.replace(/[%_]/g, "\\$&")}%`;
    conditions.push(or(like(notes.title, searchTerm), like(notes.content, searchTerm))!);

    if (category) {
      conditions.push(eq(notes.category, category as "note" | "inspiration" | "tip" | "knowledge"));
    }

    const where = and(...conditions);

    let queryBuilder = this.db
      .select({
        id: notes.id,
        title: notes.title,
        excerpt: notes.excerpt,
        slug: notes.slug,
        category: notes.category,
        wordCount: notes.wordCount,
        publishedAt: notes.publishedAt,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(where)
      .orderBy(desc(notes.publishedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // If tag filter, join with noteTags
    if (tag) {
      queryBuilder = this.db
        .select({
          id: notes.id,
          title: notes.title,
          excerpt: notes.excerpt,
          slug: notes.slug,
          category: notes.category,
          wordCount: notes.wordCount,
          publishedAt: notes.publishedAt,
          createdAt: notes.createdAt,
        })
        .from(notes)
        .innerJoin(noteTags, eq(notes.id, noteTags.noteId))
        .innerJoin(tags, eq(noteTags.tagId, tags.id))
        .where(and(where, eq(tags.slug, tag)))
        .orderBy(desc(notes.publishedAt))
        .limit(limit)
        .offset((page - 1) * limit) as typeof queryBuilder;
    }

    const [items, countResult] = await Promise.all([
      queryBuilder,
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(where)
        .get(),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        authorName: null,
      })),
      total: countResult?.count ?? 0,
      page,
      limit,
    };
  }
}
