import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { notes, noteTags, tags, user } from "@/db/schema";
import type { NoteCategory } from "@/shared/types";

export class NoteRepo {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.select().from(notes).where(eq(notes.id, id)).get();
  }

  async findBySlug(slug: string) {
    return this.db.select().from(notes).where(eq(notes.slug, slug)).get();
  }

  async findByAuthorId(
    authorId: string,
    page: number,
    limit: number,
    status?: "draft" | "published",
    category?: NoteCategory,
  ) {
    const conditions = [eq(notes.authorId, authorId)];
    if (status) conditions.push(eq(notes.status, status));
    if (category) conditions.push(eq(notes.category, category));

    return this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  async findPublished(page: number, limit: number, category?: NoteCategory, tagSlug?: string) {
    const conditions = [eq(notes.status, "published")];
    if (category) conditions.push(eq(notes.category, category));

    if (tagSlug) {
      return this.db
        .select({
          id: notes.id,
          authorId: notes.authorId,
          title: notes.title,
          excerpt: notes.excerpt,
          category: notes.category,
          slug: notes.slug,
          wordCount: notes.wordCount,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
          publishedAt: notes.publishedAt,
        })
        .from(notes)
        .innerJoin(noteTags, eq(notes.id, noteTags.noteId))
        .innerJoin(tags, eq(noteTags.tagId, tags.id))
        .where(and(...conditions, eq(tags.slug, tagSlug)))
        .orderBy(desc(notes.publishedAt))
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    }

    return this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.publishedAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  async countPublished(category?: NoteCategory) {
    const conditions = [eq(notes.status, "published")];
    if (category) conditions.push(eq(notes.category, category));

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(...conditions))
      .get();
    return result?.count ?? 0;
  }

  async countByAuthor(authorId: string, status?: "draft" | "published") {
    const conditions = [eq(notes.authorId, authorId)];
    if (status) conditions.push(eq(notes.status, status));

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(...conditions))
      .get();
    return result?.count ?? 0;
  }

  async create(data: typeof notes.$inferInsert) {
    return this.db.insert(notes).values(data).returning().get();
  }

  async update(id: string, data: Partial<typeof notes.$inferInsert>) {
    return this.db
      .update(notes)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(notes.id, id))
      .returning()
      .get();
  }

  async delete(id: string) {
    return this.db.delete(notes).where(eq(notes.id, id)).returning().get();
  }

  async setTags(noteId: string, tagIds: string[]) {
    await this.db.delete(noteTags).where(eq(noteTags.noteId, noteId)).run();
    if (tagIds.length > 0) {
      await this.db
        .insert(noteTags)
        .values(tagIds.map((tagId) => ({ noteId, tagId })))
        .run();
    }
  }

  async getTagsForNote(noteId: string) {
    return this.db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId))
      .all();
  }

  async findAuthor(authorId: string) {
    return this.db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(eq(user.id, authorId))
      .get();
  }
}
