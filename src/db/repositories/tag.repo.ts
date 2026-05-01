import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { tags, noteTags } from "@/db/schema";

export class TagRepo {
  constructor(private db: Database) {}

  async findAll() {
    return this.db.select().from(tags).all();
  }

  async findBySlug(slug: string) {
    return this.db.select().from(tags).where(eq(tags.slug, slug)).get();
  }

  async findById(id: string) {
    return this.db.select().from(tags).where(eq(tags.id, id)).get();
  }

  async create(data: typeof tags.$inferInsert) {
    return this.db.insert(tags).values(data).returning().get();
  }

  async delete(id: string) {
    return this.db.delete(tags).where(eq(tags.id, id)).returning().get();
  }

  async countNotesForTag(tagId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(noteTags)
      .where(eq(noteTags.tagId, tagId))
      .get();
    return result?.count ?? 0;
  }
}
