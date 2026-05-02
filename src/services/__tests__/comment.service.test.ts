import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import {
  CommentService,
  CommentNotFoundError,
  CommentForbiddenError,
  CommentNoteNotPublishedError,
  CommentDuplicateError,
} from "../comment.service";

const mockCommentRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findAllByNoteId: vi.fn(),
  findForAuthorByNoteId: vi.fn(),
  findForCommenterByNoteId: vi.fn(),
  findVisibleByNoteId: vi.fn(),
  countByNoteId: vi.fn(),
  countByUserAndNoteSince: vi.fn(),
  countByUserSince: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockNoteRepo = {
  findById: vi.fn(),
};

vi.mock("@/db/repositories/comment.repo", () => ({
  CommentRepo: function (_db?: any) {
    return mockCommentRepo;
  },
}));

vi.mock("@/db/repositories/note.repo", () => ({
  NoteRepo: function (_db?: any) {
    return mockNoteRepo;
  },
}));

describe("CommentService", () => {
  let service: CommentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommentService({} as any);
    (service as any).commentRepo = mockCommentRepo;
    (service as any).noteRepo = mockNoteRepo;
  });

  describe("create", () => {
    it("throws CommentNotFoundError if note doesn't exist", async () => {
      mockNoteRepo.findById.mockResolvedValue(null);
      await expect(service.create("n1", "user1", "Nice post!")).rejects.toThrow(
        CommentNotFoundError,
      );
    });

    it("throws CommentNoteNotPublishedError if note is draft", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", status: "draft", authorId: "a1" });
      await expect(service.create("n1", "user1", "Nice post!")).rejects.toThrow(
        CommentNoteNotPublishedError,
      );
    });

    it("auto-approves comment from note author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", status: "published", authorId: "a1" });
      mockCommentRepo.countByUserAndNoteSince.mockResolvedValue(0);
      mockCommentRepo.create.mockResolvedValue({ id: "c1" });
      await service.create("n1", "a1", "My own comment");
      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorApproved: 1 }),
      );
    });

    it("creates pending comment from non-author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", status: "published", authorId: "a1" });
      mockCommentRepo.countByUserAndNoteSince.mockResolvedValue(0);
      mockCommentRepo.create.mockResolvedValue({ id: "c1" });
      await service.create("n1", "user2", "Great post!");
      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorApproved: 0 }),
      );
    });

    it("throws CommentDuplicateError for duplicate content", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", status: "published", authorId: "a1" });
      mockCommentRepo.countByUserAndNoteSince.mockResolvedValue(1);
      mockCommentRepo.findAllByNoteId.mockResolvedValue([
        { authorId: "user1", content: "Same comment" },
      ]);
      await expect(service.create("n1", "user1", "Same comment")).rejects.toThrow(
        CommentDuplicateError,
      );
    });
  });

  describe("listForNote", () => {
    it("returns all comments for admin", async () => {
      mockCommentRepo.findAllByNoteId.mockResolvedValue([{ id: "c1" }]);
      mockCommentRepo.countByNoteId.mockResolvedValue(1);
      const result = await service.listForNote(
        "n1",
        { id: "admin1", role: "admin", approvalStatus: "approved" },
        1,
      );
      expect(result.items).toEqual([{ id: "c1" }]);
      expect(result.total).toBe(1);
    });

    it("returns author-visible comments for note author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockCommentRepo.findForAuthorByNoteId.mockResolvedValue([{ id: "c1" }]);
      mockCommentRepo.countByNoteId.mockResolvedValue(1);
      const _result = await service.listForNote(
        "n1",
        { id: "author1", role: "author", approvalStatus: "approved" },
        1,
      );
      expect(mockCommentRepo.findForAuthorByNoteId).toHaveBeenCalled();
    });

    it("returns public comments for anonymous", async () => {
      mockCommentRepo.findVisibleByNoteId.mockResolvedValue([]);
      mockCommentRepo.countByNoteId.mockResolvedValue(0);
      const _result = await service.listForNote("n1", null, 1);
      expect(mockCommentRepo.findVisibleByNoteId).toHaveBeenCalledWith("n1", 1, 20);
    });
  });

  describe("reviewByAuthor", () => {
    it("throws CommentNotFoundError if comment doesn't exist", async () => {
      mockCommentRepo.findById.mockResolvedValue(null);
      await expect(service.reviewByAuthor("c1", "author1", true)).rejects.toThrow(
        CommentNotFoundError,
      );
    });

    it("throws CommentForbiddenError if not the note author", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1", noteId: "n1" });
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "other" });
      await expect(service.reviewByAuthor("c1", "author1", true)).rejects.toThrow(
        CommentForbiddenError,
      );
    });

    it("approves comment", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1", noteId: "n1" });
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockCommentRepo.update.mockResolvedValue({ id: "c1", authorApproved: 1 });
      await service.reviewByAuthor("c1", "author1", true);
      expect(mockCommentRepo.update).toHaveBeenCalledWith("c1", { authorApproved: 1 });
    });

    it("rejects comment", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1", noteId: "n1" });
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockCommentRepo.update.mockResolvedValue({ id: "c1", authorApproved: 0 });
      await service.reviewByAuthor("c1", "author1", false);
      expect(mockCommentRepo.update).toHaveBeenCalledWith("c1", { authorApproved: 0 });
    });
  });

  describe("reviewByAdmin", () => {
    it("hides a comment", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1" });
      mockCommentRepo.update.mockResolvedValue({ id: "c1", adminHidden: 1 });
      await service.reviewByAdmin("c1", true);
      expect(mockCommentRepo.update).toHaveBeenCalledWith("c1", { adminHidden: 1 });
    });

    it("unhides a comment", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1" });
      mockCommentRepo.update.mockResolvedValue({ id: "c1", adminHidden: 0 });
      await service.reviewByAdmin("c1", false);
      expect(mockCommentRepo.update).toHaveBeenCalledWith("c1", { adminHidden: 0 });
    });
  });

  describe("delete", () => {
    it("allows author to delete own comment", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1", authorId: "user1" });
      mockCommentRepo.delete.mockResolvedValue(undefined);
      await service.delete("c1", "user1", false);
      expect(mockCommentRepo.delete).toHaveBeenCalledWith("c1");
    });

    it("allows admin to delete any comment", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1", authorId: "user1" });
      mockCommentRepo.delete.mockResolvedValue(undefined);
      await service.delete("c1", "admin1", true);
      expect(mockCommentRepo.delete).toHaveBeenCalledWith("c1");
    });

    it("throws CommentForbiddenError for non-owner non-admin", async () => {
      mockCommentRepo.findById.mockResolvedValue({ id: "c1", authorId: "user1" });
      await expect(service.delete("c1", "user2", false)).rejects.toThrow(CommentForbiddenError);
    });
  });

  describe("checkRateLimit", () => {
    it("allows when no recent comments", async () => {
      mockCommentRepo.countByUserAndNoteSince.mockResolvedValue(0);
      mockCommentRepo.countByUserSince.mockResolvedValue(0);
      const result = await service.checkRateLimit("user1", "n1");
      expect(result.allowed).toBe(true);
    });

    it("blocks per-note rate limit (1 per minute)", async () => {
      mockCommentRepo.countByUserAndNoteSince.mockResolvedValue(1);
      const result = await service.checkRateLimit("user1", "n1");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("PER_NOTE_RATE_LIMITED");
    });

    it("blocks hourly rate limit (20 per hour)", async () => {
      mockCommentRepo.countByUserAndNoteSince.mockResolvedValue(0);
      mockCommentRepo.countByUserSince.mockResolvedValue(20);
      const result = await service.checkRateLimit("user1", "n1");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("HOURLY_RATE_LIMITED");
    });
  });
});
