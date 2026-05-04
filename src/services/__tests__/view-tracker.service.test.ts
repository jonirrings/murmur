import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { ViewTrackerService } from "../view-tracker.service";

function createMockRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/note/test", { headers });
}

function createMockDb() {
  return {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    run: vi.fn(),
    // For ViewRepo.recordView
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

describe("ViewTrackerService", () => {
  let service: ViewTrackerService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ViewTrackerService(mockDb as any);
  });

  describe("isBot", () => {
    it("returns true for known bot user-agent (Googlebot)", () => {
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true for curl user-agent", () => {
      const req = createMockRequest({ "user-agent": "curl/7.88.1" });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true for Python requests", () => {
      const req = createMockRequest({ "user-agent": "python-requests/2.31.0" });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true for HeadlessChrome", () => {
      const req = createMockRequest({ "user-agent": "Mozilla/5.0 (HeadlessChrome)" });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true for link preview (Slack)", () => {
      const req = createMockRequest({ "user-agent": "Slackbot-LinkExpanding 1.0" });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true for empty user-agent", () => {
      const req = createMockRequest({ "user-agent": "" });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true for very short user-agent", () => {
      const req = createMockRequest({ "user-agent": "short" });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns true when cf-bot-management-score is below threshold", () => {
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "cf-bot-management-score": "20",
      });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns false when cf-bot-management-score is above threshold", () => {
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "cf-bot-management-score": "50",
      });
      expect(service.isBot(req)).toBe(false);
    });

    it("returns true when cf-verified-bot-category is not none", () => {
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "cf-verified-bot-category": "search",
      });
      expect(service.isBot(req)).toBe(true);
    });

    it("returns false when cf-verified-bot-category is none", () => {
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "cf-verified-bot-category": "none",
      });
      expect(service.isBot(req)).toBe(false);
    });

    it("returns false for normal browser user-agent without bot headers", () => {
      const req = createMockRequest({
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      expect(service.isBot(req)).toBe(false);
    });
  });

  describe("incrementViewCount", () => {
    it("returns false for bot requests without incrementing", async () => {
      const req = createMockRequest({ "user-agent": "Googlebot/2.1" });
      const result = await service.incrementViewCount("note1", req);
      expect(result).toBe(false);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("increments view count for legitimate requests", async () => {
      mockDb.execute.mockResolvedValue(undefined);
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      });
      const result = await service.incrementViewCount("note1", req);
      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns false on database error", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB error"));
      const req = createMockRequest({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      });
      const result = await service.incrementViewCount("note1", req);
      expect(result).toBe(false);
    });
  });

  describe("setViewCount", () => {
    it("sets view count to a specific value", async () => {
      mockDb.execute.mockResolvedValue(undefined);
      const result = await service.setViewCount("note1", 500);
      expect(result).toBe(true);
      expect(mockDb.set).toHaveBeenCalledWith({ viewCount: 500 });
    });

    it("returns false on database error", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB error"));
      const result = await service.setViewCount("note1", 500);
      expect(result).toBe(false);
    });
  });

  describe("batchSetViewCounts", () => {
    it("updates multiple notes and returns count of updated", async () => {
      mockDb.run
        .mockResolvedValueOnce({ meta: { changes: 1 } })
        .mockResolvedValueOnce({ meta: { changes: 1 } })
        .mockResolvedValueOnce({ meta: { changes: 0 } });

      const result = await service.batchSetViewCounts([
        { slug: "post-1", views: 100 },
        { slug: "post-2", views: 200 },
        { slug: "nonexistent", views: 50 },
      ]);

      expect(result).toBe(2);
      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it("returns 0 for empty input", async () => {
      const result = await service.batchSetViewCounts([]);
      expect(result).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("skips entries that throw errors", async () => {
      mockDb.run
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce({ meta: { changes: 1 } });

      const result = await service.batchSetViewCounts([
        { slug: "bad-slug", views: 10 },
        { slug: "good-slug", views: 20 },
      ]);

      expect(result).toBe(1);
    });
  });
});
