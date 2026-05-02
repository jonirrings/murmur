import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { TagService, TagSlugConflictError, TagNotFoundError, TagInUseError } from "../tag.service";

const mockTagRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  countNotesForTag: vi.fn(),
};

vi.mock("@/db/repositories/tag.repo", () => ({
  TagRepo: function (_db?: any) {
    return mockTagRepo;
  },
}));

describe("TagService", () => {
  let service: TagService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TagService({} as any);
    (service as any).tagRepo = mockTagRepo;
  });

  describe("list", () => {
    it("returns all tags", async () => {
      mockTagRepo.findAll.mockResolvedValue([{ id: "t1", name: "Tech", slug: "tech" }]);
      const result = await service.list();
      expect(result).toEqual([{ id: "t1", name: "Tech", slug: "tech" }]);
    });
  });

  describe("create", () => {
    it("throws TagSlugConflictError if slug exists", async () => {
      mockTagRepo.findBySlug.mockResolvedValue({ id: "t1", slug: "tech" });
      await expect(service.create({ name: "Technology", slug: "tech" })).rejects.toThrow(
        TagSlugConflictError,
      );
    });

    it("creates a new tag", async () => {
      mockTagRepo.findBySlug.mockResolvedValue(null);
      mockTagRepo.create.mockResolvedValue({ id: "t1", name: "Tech", slug: "tech" });
      const _result = await service.create({ name: "Tech", slug: "tech" });
      expect(mockTagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tech",
          slug: "tech",
          id: expect.any(String),
        }),
      );
    });
  });

  describe("delete", () => {
    it("throws TagNotFoundError if tag doesn't exist", async () => {
      mockTagRepo.findById.mockResolvedValue(null);
      await expect(service.delete("t1")).rejects.toThrow(TagNotFoundError);
    });

    it("throws TagInUseError if tag has notes", async () => {
      mockTagRepo.findById.mockResolvedValue({ id: "t1", name: "Tech" });
      mockTagRepo.countNotesForTag.mockResolvedValue(5);
      await expect(service.delete("t1")).rejects.toThrow(TagInUseError);
    });

    it("deletes tag when not in use", async () => {
      mockTagRepo.findById.mockResolvedValue({ id: "t1", name: "Tech" });
      mockTagRepo.countNotesForTag.mockResolvedValue(0);
      mockTagRepo.delete.mockResolvedValue(undefined);
      await service.delete("t1");
      expect(mockTagRepo.delete).toHaveBeenCalledWith("t1");
    });
  });
});
