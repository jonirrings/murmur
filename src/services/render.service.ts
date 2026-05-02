import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { codeToHtml } from "shiki";

let shikiReady = false;

async function ensureShiki() {
  if (!shikiReady) {
    // shiki v4 lazy-loads grammars on first call
    shikiReady = true;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Highlight code blocks using shiki v4.
 * Replaces <pre><code class="language-xxx"> blocks with highlighted HTML.
 */
async function highlightCodeBlocks(html: string): Promise<string> {
  await ensureShiki();

  const codeBlockRegex = /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g;

  const replacements: Promise<{ match: string; replacement: string }>[] = [];

  let match;
  while ((match = codeBlockRegex.exec(html)) !== null) {
    const [fullMatch, lang, code] = match;
    const decodedCode = code
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");

    replacements.push(
      codeToHtml(decodedCode, {
        lang: lang || "text",
        theme: "github-light",
      })
        .then((highlighted) => ({ match: fullMatch, replacement: highlighted }))
        .catch(() => ({
          match: fullMatch,
          replacement: `<pre><code>${escapeHtml(decodedCode)}</code></pre>`,
        })),
    );
  }

  const results = await Promise.all(replacements);
  let result = html;
  for (const { match, replacement } of results) {
    result = result.replace(match, replacement);
  }
  return result;
}

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
        img: ["src", "alt", "title", "loading", "decoding"],
      },
    })
    .use(() => (tree) => {
      // Inject lazy loading on all img elements
      function visit(node: unknown) {
        const el = node as Record<string, unknown>;
        if (el.type === "element" && el.tagName === "img") {
          el.properties = {
            ...(el.properties as Record<string, unknown>),
            loading: "lazy",
            decoding: "async",
          };
        }
        if (Array.isArray(el.children)) {
          for (const child of el.children) {
            visit(child);
          }
        }
      }
      visit(tree);
    })
    .use(rehypeStringify)
    .process(content);

  const html = String(result);

  // Apply syntax highlighting
  try {
    return await highlightCodeBlocks(html);
  } catch {
    // If shiki fails, return unhighlighted HTML
    return html;
  }
}

export function generateExcerpt(content: string, maxLen = 200): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*`[\]()>_~|-]/g, "")
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
