/** @jsxImportSource hono/jsx */
import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/utils/html";
import { visitorCounterScript } from "./visitor-counter-script";
import { t } from "@/shared/i18n/server";

interface HtmlDocumentProps {
  title: string;
  locale: string;
  description?: string;
  pageKey?: string;
  showReaderCount?: boolean;
}

const globalStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 48rem; margin: 0 auto; padding: 1.5rem; line-height: 1.6; color: #1a1a1a; min-height: 100vh; display: flex; flex-direction: column; }
  h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; }
  h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .note-card { padding: 1rem 0; border-bottom: 1px solid #e5e7eb; }
  .excerpt { color: #6b7280; margin: 0.25rem 0; }
  time { color: #9ca3af; font-size: 0.875rem; }
  .tag { display: inline-block; padding: 0.125rem 0.5rem; margin: 0.125rem; background: #f3f4f6; border-radius: 0.25rem; font-size: 0.75rem; color: #4b5563; }
  .prose { max-width: none; flex: 1; }
  .prose pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
  .prose code { font-family: "Fira Code", monospace; font-size: 0.875rem; }
  .prose img { max-width: 100%; border-radius: 0.5rem; }
  .prose blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; }
  .pagination { margin-top: 1.5rem; text-align: center; }
  .comments-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
  .comment { padding: 0.75rem 0; border-bottom: 1px solid #f3f4f6; }
  .meta { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; font-size: 0.875rem; color: #6b7280; }
  .meta .author { font-weight: 500; color: #374151; }
  .meta .author::after { content: "·"; margin-left: 0.5rem; color: #9ca3af; }
  .comment-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .comment-author { font-weight: 500; font-size: 0.875rem; }
  .comment-content { margin: 0; font-size: 0.9375rem; color: #374151; white-space: pre-wrap; }
  .no-comments { color: #9ca3af; font-style: italic; }
  .preview-badge { display: inline-block; padding: 0.25rem 0.75rem; margin-bottom: 1rem; background: #fef3c7; color: #92400e; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .hot-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .hot-tab { padding: 0.375rem 0.875rem; border-radius: 9999px; font-size: 0.875rem; background: #f3f4f6; color: #4b5563; transition: background 0.15s, color 0.15s; }
  .hot-tab:hover { background: #e5e7eb; text-decoration: none; }
  .hot-tab.active { background: #2563eb; color: #fff; }
  .hot-views { font-size: 0.75rem; color: #f59e0b; margin-left: 0.5rem; }
  .hot-note-card { display: block; padding: 1rem 0; border-bottom: 1px solid #e5e7eb; text-decoration: none; color: inherit; }
  .hot-note-card:hover { text-decoration: none; }
  .hot-note-card h2 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.25rem; color: #1a1a1a; }
  .hot-note-card .meta { display: flex; align-items: center; gap: 0.25rem; }
  .site-footer { margin-top: auto; padding: 1.5rem 0 0; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }
  .site-footer a { color: #6b7280; margin: 0 0.5rem; }
  .cookie-banner { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; padding: 0.75rem; background: #fff; border-top: 1px solid #e5e7eb; box-shadow: 0 -2px 8px rgba(0,0,0,0.08); display: none; }
  .cookie-banner.visible { display: block; }
  .cookie-banner-inner { max-width: 48rem; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .cookie-banner p { margin: 0; font-size: 0.8125rem; color: #374151; flex: 1; min-width: 0; }
  .cookie-banner-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
  .cookie-btn { padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; transition: background 0.15s; }
  .cookie-btn:hover { background: #f9fafb; }
  .cookie-btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
  .cookie-btn-primary:hover { background: #1d4ed8; }
  .site-nav { display: flex; align-items: center; gap: 1rem; }
  .github-icon { display: inline-block; width: 1rem; height: 1rem; vertical-align: middle; fill: currentColor; }
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
        <nav class="site-nav" style="margin-bottom:1rem;font-size:0.875rem;">
          <a href="/" style="font-weight:600;">
            Murmur
          </a>
          <a href="/hot">🔥 {t("hotNotes", locale)}</a>
          <a href="/about">{t("about.title", locale)}</a>
          <a
            href="https://github.com/your-org/murmur"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-flex;align-items:center;gap:0.25rem;"
          >
            <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            GitHub
          </a>
        </nav>
        {children}
        <footer class="site-footer">
          <a href="/about">{t("about.title", locale)}</a>
          <a href="/privacy">{t("privacy.title", locale)}</a>
          <a href="https://github.com/your-org/murmur" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </footer>
        {pageKey && visitorCounterScript({ pageKey, showReaderCount })}
        <div id="cookie-banner" class="cookie-banner">
          <div class="cookie-banner-inner">
            <p>{t("cookie.description", locale)}</p>
            <div class="cookie-banner-actions">
              <button
                class="cookie-btn"
                onclick="document.cookie='murmur-cookie-consent=essential;path=/;max-age=31536000;SameSite=Lax';document.getElementById('cookie-banner').classList.remove('visible')"
              >
                {t("cookie.acceptEssential", locale)}
              </button>
              <button
                class="cookie-btn cookie-btn-primary"
                onclick="document.cookie='murmur-cookie-consent=all;path=/;max-age=31536000;SameSite=Lax';document.getElementById('cookie-banner').classList.remove('visible')"
              >
                {t("cookie.acceptAll", locale)}
              </button>
            </div>
          </div>
        </div>
        {raw(
          `<script>(function(){var c=document.cookie.match(/murmur-cookie-consent=/);if(!c)document.getElementById('cookie-banner').classList.add('visible')})()</script>`,
        )}
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
