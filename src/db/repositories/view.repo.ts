import { eq, sql, and, gte, desc } from "drizzle-orm";
import type { Database } from "@/db/client";
import { noteViews, notes } from "@/db/schema";

export type HotPeriod = "1h" | "1d" | "1w" | "1mo";

const PERIOD_DURATIONS: Record<HotPeriod, string> = {
  "1h": "-1 hour",
  "1d": "-1 day",
  "1w": "-7 days",
  "1mo": "-30 days",
};

export class ViewRepo {
  constructor(private db: Database) {}

  /**
   * Record a view event. Returns true if inserted (not a duplicate).
   * Deduplicates by (noteId, ip, date) to avoid counting the same visitor multiple times per day.
   */
  async recordView(noteId: string, ip: string): Promise<boolean> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD for dedup

    // Check for duplicate
    const existing = await this.db
      .select({ id: noteViews.id })
      .from(noteViews)
      .where(
        and(eq(noteViews.noteId, noteId), eq(noteViews.ip, ip), gte(noteViews.viewedAt, today)),
      )
      .get();

    if (existing) return false;

    await this.db.insert(noteViews).values({
      id: crypto.randomUUID(),
      noteId,
      ip: ip || "unknown",
      viewedAt: now.toISOString(),
    });
    return true;
  }

  /**
   * Get hot notes ranked by view count within a time period.
   * Returns notes with their view counts, joined with note data.
   */
  async findHotNotes(
    period: HotPeriod,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      title: string;
      excerpt: string;
      slug: string | null;
      category: string;
      publishedAt: string | null;
      createdAt: string;
      viewCount: number;
      periodViews: number;
    }>
  > {
    const duration = PERIOD_DURATIONS[period];

    const result = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        excerpt: notes.excerpt,
        slug: notes.slug,
        category: notes.category,
        publishedAt: notes.publishedAt,
        createdAt: notes.createdAt,
        viewCount: notes.viewCount,
        periodViews: sql<number>`count(${noteViews.id})`.as("period_views"),
      })
      .from(noteViews)
      .innerJoin(notes, eq(noteViews.noteId, notes.id))
      .where(
        and(
          eq(notes.status, "published"),
          gte(noteViews.viewedAt, sql`datetime('now', ${duration})`),
        ),
      )
      .groupBy(notes.id)
      .orderBy(desc(sql`period_views`))
      .limit(limit)
      .all();

    return result;
  }

  /**
   * Clean up view records older than the specified days.
   * Called by cron to prevent unbounded growth.
   */
  async cleanOldViews(olderThanDays: number): Promise<number> {
    const result = await this.db
      .delete(noteViews)
      .where(sql`${noteViews.viewedAt} < datetime('now', '-' || ${olderThanDays} || ' days')`)
      .run();
    return result.meta.changes;
  }
}
