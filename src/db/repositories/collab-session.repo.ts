import { eq, and, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { collabSessions } from "@/db/schema";

interface CreateSessionData {
  id: string;
  noteId: string;
  creatorId?: string;
  role?: "editor" | "viewer";
  token?: string;
  isActive?: number;
  createdAt: string;
  expiresAt: string;
}

export class CollabSessionRepo {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.select().from(collabSessions).where(eq(collabSessions.id, id)).get();
  }

  async findActiveByNoteId(noteId: string) {
    return this.db
      .select()
      .from(collabSessions)
      .where(and(eq(collabSessions.noteId, noteId), eq(collabSessions.isActive, 1)))
      .all();
  }

  async create(sessionData: CreateSessionData) {
    await this.db.insert(collabSessions).values({
      id: sessionData.id,
      noteId: sessionData.noteId,
      creatorId: sessionData.creatorId ?? null,
      role: sessionData.role ?? "editor",
      token: sessionData.token ?? null,
      isActive: sessionData.isActive ?? 1,
      createdAt: sessionData.createdAt,
      expiresAt: sessionData.expiresAt,
    });
    return this.findById(sessionData.id);
  }

  async deactivate(id: string) {
    await this.db.update(collabSessions).set({ isActive: 0 }).where(eq(collabSessions.id, id));
  }

  async deactivateExpired() {
    const now = new Date().toISOString();
    const expired = await this.db
      .select()
      .from(collabSessions)
      .where(and(eq(collabSessions.isActive, 1), lt(collabSessions.expiresAt, now)))
      .all();

    for (const session of expired) {
      await this.deactivate(session.id);
    }

    return expired.length;
  }

  async deleteOldInactive() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await this.db
      .delete(collabSessions)
      .where(and(eq(collabSessions.isActive, 0), lt(collabSessions.expiresAt, oneDayAgo)));
  }
}
