/** @jsxImportSource hono/jsx */
import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/utils/html";
import { visitorCounterScript } from "./visitor-counter-script";

interface HtmlDocumentProps {
  title: string;
  locale: string;
  description?: string;
  pageKey?: string;
  showReaderCount?: boolean;
}

const globalStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 48rem; margin: 0 auto; padding: 1.5rem; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; }
  h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .note-card { padding: 1rem 0; border-bottom: 1px solid #e5e7eb; }
  .excerpt { color: #6b7280; margin: 0.25rem 0; }
  time { color: #9ca3af; font-size: 0.875rem; }
  .tag { display: inline-block; padding: 0.125rem 0.5rem; margin: 0.125rem; background: #f3f4f6; border-radius: 0.25rem; font-size: 0.75rem; color: #4b5563; }
  .prose { max-width: none; }
  .prose pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
  .prose code { font-family: "Fira Code", monospace; font-size: 0.875rem; }
  .prose img { max-width: 100%; border-radius: 0.5rem; }
  .prose blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; }
  .pagination { margin-top: 1.5rem; text-align: center; }
  .comments-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
  .comment { padding: 0.75rem 0; border-bottom: 1px solid #f3f4f6; }
  .comment-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .comment-author { font-weight: 500; font-size: 0.875rem; }
  .comment-content { margin: 0; font-size: 0.9375rem; color: #374151; white-space: pre-wrap; }
  .no-comments { color: #9ca3af; font-style: italic; }
  .preview-badge { display: inline-block; padding: 0.25rem 0.75rem; margin-bottom: 1rem; background: #fef3c7; color: #92400e; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
`;

export const HtmlDocument: FC<PropsWithChildren<HtmlDocumentProps>> = ({
  title,
  locale,
  description,
  pageKey,
  showReaderCount,
  children,
}) => {
  return (
    <html lang={locale}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#111827" />
        <title>{title} - Murmur</title>
        {description && <meta name="description" content={description} />}
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        {description && <meta name="twitter:description" content={description} />}
        <style>{raw(globalStyles)}</style>
      </head>
      <body>
        {showReaderCount && (
          <div
            class="reader-count"
            style="display:flex;justify-content:flex-end;align-items:center;padding:0.25rem 0;font-size:0.75rem;color:#9ca3af;"
          >
            <span id="vc-count" style="display:inline-flex;align-items:center;gap:0.25rem;">
              👁 …
            </span>
          </div>
        )}
        {children}
        {pageKey && visitorCounterScript({ pageKey, showReaderCount })}
      </body>
    </html>
  );
};

export function formatDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
