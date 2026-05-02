import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { comments, user } from "@/db/schema";

export class CommentRepo {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.select().from(comments).where(eq(comments.id, id)).get();
  }

  async create(data: typeof comments.$inferInsert) {
    return this.db.insert(comments).values(data).returning().get();
  }

  async update(id: string, data: Partial<typeof comments.$inferInsert>) {
    return this.db
      .update(comments)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, id))
      .returning()
      .get();
  }

  async delete(id: string) {
    return this.db.delete(comments).where(eq(comments.id, id)).returning().get();
  }

  /** List comments visible to the public (author_approved + admin_visible) */
  async findVisibleByNoteId(noteId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        noteId: comments.noteId,
        authorId: comments.authorId,
        content: comments.content,
        authorApproved: comments.authorApproved,
        adminHidden: comments.adminHidden,
        createdAt: comments.createdAt,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comments)
      .innerJoin(user, eq(comments.authorId, user.id))
      .where(
        and(
          eq(comments.noteId, noteId),
          eq(comments.authorApproved, 1),
          eq(comments.adminHidden, 0),
          eq(user.approvalStatus, "approved"),
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  /** List comments visible to the note author (own + approved users' approved comments) */
  async findForAuthorByNoteId(noteId: string, authorUserId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        noteId: comments.noteId,
        authorId: comments.authorId,
        content: comments.content,
        authorApproved: comments.authorApproved,
        adminHidden: comments.adminHidden,
        createdAt: comments.createdAt,
        authorName: user.name,
        authorImage: user.image,
        authorApprovalStatus: user.approvalStatus,
      })
      .from(comments)
      .innerJoin(user, eq(comments.authorId, user.id))
      .where(
        and(
          eq(comments.noteId, noteId),
          eq(comments.adminHidden, 0),
          sql`(${user.approvalStatus} = 'approved' AND ${comments.authorApproved} = 1) OR ${comments.authorId} = ${authorUserId}`,
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  /** List comments for the comment author (own comments that are not hidden) */
  async findForCommenterByNoteId(noteId: string, commenterId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        noteId: comments.noteId,
        authorId: comments.authorId,
        content: comments.content,
        authorApproved: comments.authorApproved,
        adminHidden: comments.adminHidden,
        createdAt: comments.createdAt,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comments)
      .innerJoin(user, eq(comments.authorId, user.id))
      .where(
        and(
          eq(comments.noteId, noteId),
          eq(comments.adminHidden, 0),
          sql`(${user.approvalStatus} = 'approved' AND ${comments.authorApproved} = 1) OR ${comments.authorId} = ${commenterId}`,
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  /** List all comments for a note (admin view) */
  async findAllByNoteId(noteId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        noteId: comments.noteId,
        authorId: comments.authorId,
        content: comments.content,
        authorApproved: comments.authorApproved,
        adminHidden: comments.adminHidden,
        createdAt: comments.createdAt,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comments)
      .innerJoin(user, eq(comments.authorId, user.id))
      .where(eq(comments.noteId, noteId))
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  async countByNoteId(noteId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.noteId, noteId))
      .get();
    return result?.count ?? 0;
  }

  async countPendingByNoteId(noteId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.noteId, noteId), eq(comments.authorApproved, 0)))
      .get();
    return result?.count ?? 0;
  }

  /** Count comments by a specific user in a time window (for rate limiting) */
  async countByUserSince(userId: string, since: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), sql`${comments.createdAt} >= ${since}`))
      .get();
    return result?.count ?? 0;
  }

  /** Count pending comments (authorApproved = 0) across all notes */
  async countPending() {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.authorApproved, 0))
      .get();
    return result?.count ?? 0;
  }

  /** Count comments by a specific user on a specific note in a time window */
  async countByUserAndNoteSince(userId: string, noteId: string, since: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(
        and(
          eq(comments.authorId, userId),
          eq(comments.noteId, noteId),
          sql`${comments.createdAt} >= ${since}`,
        ),
      )
      .get();
    return result?.count ?? 0;
  }

  /** List all comments with pagination and filters (admin view) */
  async findAllPaginated(
    page: number,
    limit: number,
    filters?: {
      noteId?: string;
      authorApproved?: number;
      adminHidden?: number;
    },
  ) {
    const conditions = [];
    if (filters?.noteId) conditions.push(eq(comments.noteId, filters.noteId));
    if (filters?.authorApproved !== undefined)
      conditions.push(eq(comments.authorApproved, filters.authorApproved));
    if (filters?.adminHidden !== undefined)
      conditions.push(eq(comments.adminHidden, filters.adminHidden));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      this.db
        .select({
          id: comments.id,
          noteId: comments.noteId,
          authorId: comments.authorId,
          content: comments.content,
          authorApproved: comments.authorApproved,
          adminHidden: comments.adminHidden,
          createdAt: comments.createdAt,
          authorName: user.name,
          authorImage: user.image,
        })
        .from(comments)
        .innerJoin(user, eq(comments.authorId, user.id))
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(limit)
        .offset((page - 1) * limit)
        .all(),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(comments)
        .where(where)
        .get(),
    ]);

    return { items, total: countResult?.count ?? 0 };
  }
}
