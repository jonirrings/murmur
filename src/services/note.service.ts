import type { Database } from "@/db/client";
import { NoteRepo } from "@/db/repositories/note.repo";
import { ViewRepo, type HotPeriod } from "@/db/repositories/view.repo";
import { TagRepo } from "@/db/repositories/tag.repo";
import type { CreateNoteInput, UpdateNoteInput } from "@/shared/schemas/note";
import type { NoteCategory } from "@/shared/types";
import { slugify } from "transliteration";

function generateSlug(title: string): string {
  // transliteration's slugify converts Chinese/Japanese/Korean etc. to Latin
  // e.g. "你好世界" → "ni-hao-shi-jie", "Hello World" → "hello-world"
  const slug = slugify(title, { lowercase: true, separator: "-", trim: true }).slice(0, 100);

  // Fallback for edge cases where transliteration yields nothing
  if (!slug || slug.replace(/-/g, "").length === 0) {
    return crypto.randomUUID().slice(0, 8);
  }

  return slug;
}

function generateExcerpt(content: string, maxLen = 200): string {
  const plain = content.replace(/[#*`[\]()>_~|-]/g, "").trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
}

function countWords(content: string): number {
  return content.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

export class NoteService {
  private noteRepo: NoteRepo;
  private tagRepo: TagRepo;
  private viewRepo: ViewRepo;

  constructor(db: Database) {
    this.noteRepo = new NoteRepo(db);
    this.tagRepo = new TagRepo(db);
    this.viewRepo = new ViewRepo(db);
  }

  async create(authorId: string, input: CreateNoteInput) {
    const now = new Date().toISOString();
    const note = await this.noteRepo.create({
      id: crypto.randomUUID(),
      authorId,
      title: input.title,
      content: input.content,
      excerpt: generateExcerpt(input.content),
      category: input.category,
      status: "draft",
      wordCount: countWords(input.content),
      createdAt: now,
      updatedAt: now,
    });

    if (input.tagIds?.length) {
      await this.noteRepo.setTags(note.id, input.tagIds);
    }

    return note;
  }

  async update(noteId: string, authorId: string, input: UpdateNoteInput) {
    const existing = await this.noteRepo.findById(noteId);
    if (!existing) throw new NoteNotFoundError();
    if (existing.authorId !== authorId) throw new NoteForbiddenError();

    const updates: Partial<typeof import("@/db/schema").notes.$inferInsert> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.content !== undefined) {
      updates.content = input.content;
      updates.excerpt = generateExcerpt(input.content);
      updates.wordCount = countWords(input.content);
    }
    if (input.category !== undefined) updates.category = input.category;
    if (input.excerpt !== undefined) updates.excerpt = input.excerpt;

    const note = await this.noteRepo.update(noteId, updates);

    if (input.tagIds !== undefined) {
      await this.noteRepo.setTags(noteId, input.tagIds);
    }

    return note;
  }

  async publish(noteId: string, authorId: string, slug?: string) {
    const existing = await this.noteRepo.findById(noteId);
    if (!existing) throw new NoteNotFoundError();
    if (existing.authorId !== authorId) throw new NoteForbiddenError();

    const finalSlug = slug ?? generateSlug(existing.title);

    // Check slug uniqueness
    const existingSlug = await this.noteRepo.findBySlug(finalSlug);
    if (existingSlug && existingSlug.id !== noteId) {
      throw new SlugConflictError();
    }

    return this.noteRepo.update(noteId, {
      status: "published",
      slug: finalSlug,
      publishedAt: new Date().toISOString(),
    });
  }

  async unpublish(noteId: string, authorId: string) {
    const existing = await this.noteRepo.findById(noteId);
    if (!existing) throw new NoteNotFoundError();
    if (existing.authorId !== authorId) throw new NoteForbiddenError();

    return this.noteRepo.update(noteId, {
      status: "draft",
    });
  }

  async delete(noteId: string, authorId: string) {
    const existing = await this.noteRepo.findById(noteId);
    if (!existing) throw new NoteNotFoundError();
    if (existing.authorId !== authorId) throw new NoteForbiddenError();

    return this.noteRepo.delete(noteId);
  }

  async getById(noteId: string) {
    const note = await this.noteRepo.findById(noteId);
    if (!note) throw new NoteNotFoundError();

    const [tagList, author] = await Promise.all([
      this.noteRepo.getTagsForNote(noteId),
      this.noteRepo.findAuthor(note.authorId),
    ]);

    return { ...note, tags: tagList, author };
  }

  async getBySlug(slug: string) {
    const note = await this.noteRepo.findBySlug(slug);
    if (!note) throw new NoteNotFoundError();

    const [tagList, author] = await Promise.all([
      this.noteRepo.getTagsForNote(note.id),
      this.noteRepo.findAuthor(note.authorId),
    ]);

    return { ...note, tags: tagList, author };
  }

  async listByAuthor(
    authorId: string,
    page: number,
    limit: number,
    status?: "draft" | "published",
    category?: NoteCategory,
  ) {
    const [items, total] = await Promise.all([
      this.noteRepo.findByAuthorId(authorId, page, limit, status, category),
      this.noteRepo.countByAuthor(authorId, status),
    ]);
    return { items, total, page, limit };
  }

  async listPublished(page: number, limit: number, category?: NoteCategory, tagSlug?: string) {
    const [items, total] = await Promise.all([
      this.noteRepo.findPublished(page, limit, category, tagSlug),
      this.noteRepo.countPublished(category),
    ]);
    return { items, total, page, limit };
  }

  /**
   * List hot/trending notes by view count within a time period.
   * Uses the note_views table for time-windowed aggregation.
   */
  async listHot(period: HotPeriod, limit: number) {
    const items = await this.viewRepo.findHotNotes(period, limit);
    return { items, period, limit };
  }
}

export class NoteNotFoundError extends Error {
  constructor() {
    super("Note not found");
    this.name = "NoteNotFoundError";
  }
}

export class NoteForbiddenError extends Error {
  constructor() {
    super("Note forbidden");
    this.name = "NoteForbiddenError";
  }
}

export class SlugConflictError extends Error {
  constructor() {
    super("Slug conflict");
    this.name = "SlugConflictError";
  }
}
