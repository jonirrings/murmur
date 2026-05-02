import { describe, it, expect } from "vite-plus/test";
import { generateExcerpt, countWords } from "../render.service";

describe("search.service unit tests", () => {
  describe("generateExcerpt for search results", () => {
    it("handles empty content", () => {
      expect(generateExcerpt("")).toBe("");
    });

    it("handles content with only code blocks", () => {
      const content = "```\nconsole.log('hello');\n```";
      const excerpt = generateExcerpt(content);
      expect(excerpt.trim().length).toBeLessThanOrEqual(200);
    });
  });

  describe("countWords for search indexing", () => {
    it("counts markdown with mixed content", () => {
      const content = "# Title\n\nParagraph with **bold** text.\n\n- List item 1\n- List item 2";
      const words = countWords(content);
      expect(words).toBeGreaterThan(0);
    });
  });
});
