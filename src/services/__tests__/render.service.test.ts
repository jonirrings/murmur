import { describe, it, expect } from "vite-plus/test";
import { generateExcerpt, countWords } from "../render.service";

describe("render.service", () => {
  describe("generateExcerpt", () => {
    it("generates excerpt from plain text", () => {
      const content = "This is a simple note about something interesting.";
      const excerpt = generateExcerpt(content);
      expect(excerpt).toBe("This is a simple note about something interesting.");
    });

    it("truncates long content with ellipsis", () => {
      const content = "A".repeat(300);
      const excerpt = generateExcerpt(content, 200);
      expect(excerpt.length).toBe(201); // 200 + "…"
      expect(excerpt.endsWith("…")).toBe(true);
    });

    it("strips markdown syntax", () => {
      const content = "# Hello **World**\n\nThis is `code` and [a link](https://example.com).";
      const excerpt = generateExcerpt(content);
      expect(excerpt).not.toContain("#");
      expect(excerpt).not.toContain("**");
      expect(excerpt).not.toContain("`");
      expect(excerpt).not.toContain("[");
    });

    it("strips code blocks", () => {
      const content = "Before\n```\nconst x = 1;\n```\nAfter";
      const excerpt = generateExcerpt(content);
      expect(excerpt).not.toContain("const x");
      expect(excerpt).toContain("Before");
      expect(excerpt).toContain("After");
    });
  });

  describe("countWords", () => {
    it("counts English words", () => {
      expect(countWords("hello world")).toBe(2);
    });

    it("counts CJK characters individually", () => {
      expect(countWords("你好世界")).toBe(4);
    });

    it("counts mixed content", () => {
      const result = countWords("Hello 你好 World 世界");
      expect(result).toBe(6); // 2 English words + 4 CJK chars
    });

    it("handles empty string", () => {
      expect(countWords("")).toBe(0);
    });
  });
});
