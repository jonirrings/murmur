import type { Database } from "@/db/client";
import { CommentRepo } from "@/db/repositories/comment.repo";
import { NoteRepo } from "@/db/repositories/note.repo";
import { COMMENTS_PER_PAGE } from "@/shared/constants";

export class CommentService {
  private commentRepo: CommentRepo;
  private noteRepo: NoteRepo;

  constructor(db: Database) {
    this.commentRepo = new CommentRepo(db);
    this.noteRepo = new NoteRepo(db);
  }

  /** Create a comment — auto-approve if author is the note author */
  async create(noteId: string, authorId: string, content: string) {
    const note = await this.noteRepo.findById(noteId);
    if (!note) throw new CommentNotFoundError();
    if (note.status !== "published") throw new CommentNoteNotPublishedError();

    // Duplicate content check: same user, same note, same content within 1 minute
    const duplicateCount = await this.commentRepo.countByUserAndNoteSince(
      authorId,
      noteId,
      new Date(Date.now() - 60_000).toISOString(),
    );
    if (duplicateCount > 0) {
      const recent = await this.commentRepo.findAllByNoteId(noteId, 1, 1);
      const ownRecent = recent.find((c) => c.authorId === authorId && c.content === content);
      if (ownRecent) {
        throw new CommentDuplicateError();
      }
    }

    // If the commenter is the note author, auto-approve
    const isNoteAuthor = note.authorId === authorId;
    const authorApproved = isNoteAuthor ? 1 : 0;

    return this.commentRepo.create({
      id: crypto.randomUUID(),
      noteId,
      authorId,
      content,
      authorApproved,
      adminHidden: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * List comments for a note based on viewer role.
   *
   * Visibility rules:
   * - Anonymous: only author_approved=1 AND admin_hidden=0 AND user.approval_status='approved'
   * - Logged in: above + own comments (admin_hidden=0)
   * - Note author: above + pending comments from approved users on their notes
   * - Admin: all comments (including hidden, flagged)
   */
  async listForNote(
    noteId: string,
    viewer: {
      id?: string;
      role: "admin" | "author" | "commenter";
      approvalStatus: string;
    } | null,
    page: number,
    limit: number = COMMENTS_PER_PAGE,
  ) {
    if (viewer?.role === "admin") {
      const [items, total] = await Promise.all([
        this.commentRepo.findAllByNoteId(noteId, page, limit),
        this.commentRepo.countByNoteId(noteId),
      ]);
      return { items, total, page, limit };
    }

    // Check if viewer is the note author
    const note = await this.noteRepo.findById(noteId);
    const isNoteAuthor = note && viewer?.id === note.authorId;

    if (isNoteAuthor) {
      const items = await this.commentRepo.findForAuthorByNoteId(noteId, viewer!.id!, page, limit);
      const total = await this.commentRepo.countByNoteId(noteId);
      return { items, total, page, limit };
    }

    if (viewer?.id) {
      const items = await this.commentRepo.findForCommenterByNoteId(noteId, viewer.id, page, limit);
      const total = await this.commentRepo.countByNoteId(noteId);
      return { items, total, page, limit };
    }

    // Anonymous: only public comments
    const items = await this.commentRepo.findVisibleByNoteId(noteId, page, limit);
    const total = await this.commentRepo.countByNoteId(noteId);
    return { items, total, page, limit };
  }

  /** Note author approves/rejects a comment */
  async reviewByAuthor(commentId: string, noteAuthorId: string, approved: boolean) {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) throw new CommentNotFoundError();

    // Verify the reviewer is the note author
    const note = await this.noteRepo.findById(comment.noteId);
    if (!note || note.authorId !== noteAuthorId) {
      throw new CommentForbiddenError();
    }

    return this.commentRepo.update(commentId, {
      authorApproved: approved ? 1 : 0,
    });
  }

  /** Admin hides/shows a comment */
  async reviewByAdmin(commentId: string, hidden: boolean) {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) throw new CommentNotFoundError();

    return this.commentRepo.update(commentId, {
      adminHidden: hidden ? 1 : 0,
    });
  }

  /** Delete a comment — only the author or admin can delete */
  async delete(commentId: string, userId: string, isAdmin: boolean) {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) throw new CommentNotFoundError();

    if (comment.authorId !== userId && !isAdmin) {
      throw new CommentForbiddenError();
    }

    return this.commentRepo.delete(commentId);
  }

  /** Check rate limit: max 1 comment per minute per user per note, 20 per hour */
  async checkRateLimit(
    userId: string,
    noteId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Per-note-per-minute check
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const perNoteCount = await this.commentRepo.countByUserAndNoteSince(
      userId,
      noteId,
      oneMinuteAgo,
    );
    if (perNoteCount >= 1) {
      return { allowed: false, reason: "PER_NOTE_RATE_LIMITED" };
    }

    // Per-hour check
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const hourlyCount = await this.commentRepo.countByUserSince(userId, oneHourAgo);
    if (hourlyCount >= 20) {
      return { allowed: false, reason: "HOURLY_RATE_LIMITED" };
    }

    return { allowed: true };
  }
}

export class CommentNotFoundError extends Error {
  constructor() {
    super("评论不存在");
    this.name = "CommentNotFoundError";
  }
}

export class CommentForbiddenError extends Error {
  constructor() {
    super("无权操作此评论");
    this.name = "CommentForbiddenError";
  }
}

export class CommentNoteNotPublishedError extends Error {
  constructor() {
    super("只能在已发布的笔记下评论");
    this.name = "CommentNoteNotPublishedError";
  }
}

export class CommentDuplicateError extends Error {
  constructor() {
    super("请勿重复提交相同评论");
    this.name = "CommentDuplicateError";
  }
}
