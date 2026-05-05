import { describe, it, expect } from "vite-plus/test";
import { t } from "@/shared/i18n/server";

describe("i18n server", () => {
  describe("t", () => {
    it("returns Chinese text for zh-CN locale", () => {
      expect(t("noNotes", "zh-CN")).toBe("暂无笔记");
      expect(t("anonymous", "zh-CN")).toBe("匿名");
    });

    it("returns English text for en locale", () => {
      expect(t("noNotes", "en")).toBe("No notes yet");
      expect(t("anonymous", "en")).toBe("Anonymous");
    });

    it("returns Japanese text for ja locale", () => {
      expect(t("noNotes", "ja")).toBe("ノートはまだありません");
      expect(t("anonymous", "ja")).toBe("匿名");
    });

    it("interpolates params", () => {
      expect(t("commentsHeading", "zh-CN", { count: "5" })).toBe("评论 (5)");
      expect(t("commentsHeading", "en", { count: "5" })).toBe("Comments (5)");
      expect(t("tag", "zh-CN", { slug: "tech" })).toBe("标签: tech");
      expect(t("tag", "en", { slug: "tech" })).toBe("Tag: tech");
    });

    it("returns key when not found", () => {
      expect(t("nonexistent.key", "zh-CN")).toBe("nonexistent.key");
    });

    it("falls back to en for unknown locale", () => {
      expect(t("noNotes", "ko")).toBe("No notes yet");
    });
  });
});
