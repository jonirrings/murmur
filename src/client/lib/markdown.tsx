import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipeline: any = null;

function getPipeline() {
  if (!pipeline) {
    pipeline = unified()
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
      .use(rehypeStringify);
  }
  return pipeline;
}

export async function renderMarkdown(content: string): Promise<string> {
  const processor = getPipeline();
  const result = await processor.process(content);
  return String(result);
}
