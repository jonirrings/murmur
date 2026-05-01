import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

export async function renderMarkdown(content: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        code: [["className", "language-*"]],
        span: [["className", "language-*"]],
      },
    })
    .use(rehypeStringify)
    .process(content);

  return String(result);
}

export function generateExcerpt(content: string, maxLen = 200): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*`\[\]()>_~|-]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
}

export function countWords(content: string): number {
  // Count CJK characters + English words
  const cjk = (content.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const english = content
    .replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  return cjk + english;
}
