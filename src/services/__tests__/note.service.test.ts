import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import {
  NoteService,
  NoteNotFoundError,
  NoteForbiddenError,
  SlugConflictError,
} from "../note.service";

const mockNoteRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByAuthorId: vi.fn(),
  findPublished: vi.fn(),
  countByAuthor: vi.fn(),
  countPublished: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  setTags: vi.fn(),
  getTagsForNote: vi.fn(),
  findAuthor: vi.fn(),
};

const mockTagRepo = {
  findAll: vi.fn(),
  findBySlug: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/db/repositories/note.repo", () => ({
  NoteRepo: function (_db?: any) {
    return mockNoteRepo;
  },
}));

vi.mock("@/db/repositories/tag.repo", () => ({
  TagRepo: function (_db?: any) {
    return mockTagRepo;
  },
}));

describe("NoteService", () => {
  let service: NoteService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NoteService({} as any);
    (service as any).noteRepo = mockNoteRepo;
    (service as any).tagRepo = mockTagRepo;
  });

  describe("create", () => {
    it("creates a note with generated excerpt and word count", async () => {
      mockNoteRepo.create.mockResolvedValue({ id: "n1", title: "Test" });
      const result = await service.create("author1", {
        title: "Test Note",
        content: "Hello world this is content",
        category: "note",
      });
      expect(mockNoteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: "author1",
          title: "Test Note",
          status: "draft",
        }),
      );
      expect(result).toEqual({ id: "n1", title: "Test" });
    });

    it("sets tags when tagIds provided", async () => {
      mockNoteRepo.create.mockResolvedValue({ id: "n1" });
      await service.create("author1", {
        title: "Test",
        content: "Content",
        category: "note",
        tagIds: ["t1", "t2"],
      });
      expect(mockNoteRepo.setTags).toHaveBeenCalledWith("n1", ["t1", "t2"]);
    });

    it("skips tags when no tagIds", async () => {
      mockNoteRepo.create.mockResolvedValue({ id: "n1" });
      await service.create("author1", {
        title: "Test",
        content: "Content",
        category: "note",
      });
      expect(mockNoteRepo.setTags).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("throws NoteNotFoundError if note doesn't exist", async () => {
      mockNoteRepo.findById.mockResolvedValue(null);
      await expect(service.update("n1", "author1", { title: "New" })).rejects.toThrow(
        NoteNotFoundError,
      );
    });

    it("throws NoteForbiddenError if not the author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author2" });
      await expect(service.update("n1", "author1", { title: "New" })).rejects.toThrow(
        NoteForbiddenError,
      );
    });

    it("updates content with new excerpt and word count", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockNoteRepo.update.mockResolvedValue({ id: "n1", title: "Updated" });
      await service.update("n1", "author1", { content: "New content here" });
      expect(mockNoteRepo.update).toHaveBeenCalledWith(
        "n1",
        expect.objectContaining({
          content: "New content here",
          excerpt: expect.any(String),
          wordCount: expect.any(Number),
        }),
      );
    });

    it("replaces tags when tagIds provided", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockNoteRepo.update.mockResolvedValue({ id: "n1" });
      await service.update("n1", "author1", { tagIds: ["t1"] });
      expect(mockNoteRepo.setTags).toHaveBeenCalledWith("n1", ["t1"]);
    });
  });

  describe("publish", () => {
    it("throws NoteNotFoundError if note doesn't exist", async () => {
      mockNoteRepo.findById.mockResolvedValue(null);
      await expect(service.publish("n1", "author1")).rejects.toThrow(NoteNotFoundError);
    });

    it("throws NoteForbiddenError if not the author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "other" });
      await expect(service.publish("n1", "author1")).rejects.toThrow(NoteForbiddenError);
    });

    it("throws SlugConflictError if slug taken by another note", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1", title: "Test" });
      mockNoteRepo.findBySlug.mockResolvedValue({ id: "n2" });
      await expect(service.publish("n1", "author1")).rejects.toThrow(SlugConflictError);
    });

    it("publishes with auto-generated slug", async () => {
      mockNoteRepo.findById.mockResolvedValue({
        id: "n1",
        authorId: "author1",
        title: "Hello World",
      });
      mockNoteRepo.findBySlug.mockResolvedValue(null);
      mockNoteRepo.update.mockResolvedValue({ id: "n1", status: "published" });
      await service.publish("n1", "author1");
      expect(mockNoteRepo.update).toHaveBeenCalledWith(
        "n1",
        expect.objectContaining({
          status: "published",
          slug: "hello-world",
        }),
      );
    });

    it("publishes with custom slug", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1", title: "Test" });
      mockNoteRepo.findBySlug.mockResolvedValue(null);
      mockNoteRepo.update.mockResolvedValue({ id: "n1", status: "published" });
      await service.publish("n1", "author1", "custom-slug");
      expect(mockNoteRepo.update).toHaveBeenCalledWith(
        "n1",
        expect.objectContaining({ slug: "custom-slug" }),
      );
    });
  });

  describe("unpublish", () => {
    it("sets status back to draft", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockNoteRepo.update.mockResolvedValue({ id: "n1", status: "draft" });
      const _result = await service.unpublish("n1", "author1");
      expect(mockNoteRepo.update).toHaveBeenCalledWith("n1", { status: "draft" });
    });
  });

  describe("delete", () => {
    it("deletes note owned by the author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "author1" });
      mockNoteRepo.delete.mockResolvedValue(undefined);
      await service.delete("n1", "author1");
      expect(mockNoteRepo.delete).toHaveBeenCalledWith("n1");
    });

    it("throws NoteForbiddenError if not the author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "other" });
      await expect(service.delete("n1", "author1")).rejects.toThrow(NoteForbiddenError);
    });
  });

  describe("getById", () => {
    it("returns note with tags and author", async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: "n1", authorId: "a1" });
      mockNoteRepo.getTagsForNote.mockResolvedValue([{ name: "tech", slug: "tech" }]);
      mockNoteRepo.findAuthor.mockResolvedValue({ name: "Alice" });
      const result = await service.getById("n1");
      expect(result).toEqual({
        id: "n1",
        authorId: "a1",
        tags: [{ name: "tech", slug: "tech" }],
        author: { name: "Alice" },
      });
    });

    it("throws NoteNotFoundError if not found", async () => {
      mockNoteRepo.findById.mockResolvedValue(null);
      await expect(service.getById("n1")).rejects.toThrow(NoteNotFoundError);
    });
  });
});
