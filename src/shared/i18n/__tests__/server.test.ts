import { describe, it, expect } from "vite-plus/test";
import { detectLocale, t } from "@/shared/i18n/server";

describe("i18n server", () => {
  describe("detectLocale", () => {
    it("defaults to zh-CN when no Accept-Language", () => {
      expect(detectLocale()).toBe("zh-CN");
      expect(detectLocale(null)).toBe("zh-CN");
      expect(detectLocale(undefined)).toBe("zh-CN");
    });

    it("returns zh-CN for Chinese Accept-Language", () => {
      expect(detectLocale("zh-CN,zh;q=0.9")).toBe("zh-CN");
      expect(detectLocale("zh-TW,zh;q=0.9")).toBe("zh-CN");
      expect(detectLocale("zh")).toBe("zh-CN");
    });

    it("returns en for non-Chinese Accept-Language", () => {
      expect(detectLocale("en-US,en;q=0.9")).toBe("en");
      expect(detectLocale("ja")).toBe("en");
      expect(detectLocale("fr-FR")).toBe("en");
    });
  });

  describe("t", () => {
    it("returns Chinese text for zh-CN locale", () => {
      expect(t("noNotes", "zh-CN")).toBe("暂无笔记");
      expect(t("anonymous", "zh-CN")).toBe("匿名");
    });

    it("returns English text for en locale", () => {
      expect(t("noNotes", "en")).toBe("No notes yet");
      expect(t("anonymous", "en")).toBe("Anonymous");
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

    it("falls back to zh-CN for unknown locale", () => {
      expect(t("noNotes", "ja")).toBe("暂无笔记");
    });
  });
});
