/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { HtmlDocument, formatDate } from "./layout";
import { NoteCard } from "./note-card";
import { CommentItem } from "./comment-item";
import { Pagination } from "./pagination";
import { detectLocale, t } from "@/shared/i18n/server";

interface NoteListPageProps {
  notes: Array<{
    id: string;
    title: string;
    excerpt: string;
    slug: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  acceptLanguage?: string | null;
  pageKey?: string;
}

export const NoteListPage: FC<NoteListPageProps> = ({
  notes,
  total,
  page,
  acceptLanguage,
  pageKey,
}) => {
  const locale = detectLocale(acceptLanguage);
  return (
    <HtmlDocument title="Murmur" locale={locale} pageKey={pageKey}>
      <div class="container">
        <h1>Murmur</h1>
        <div class="notes-list">
          {notes.length > 0 ? (
            notes.map((note) => (
              <NoteCard
                title={note.title}
                slug={note.slug ?? ""}
                id={note.id}
                excerpt={note.excerpt}
                publishedAt={note.publishedAt}
                createdAt={note.createdAt}
                locale={locale}
              />
            ))
          ) : (
            <p>{t("noNotes", locale)}</p>
          )}
        </div>
        <Pagination
          currentPage={page}
          total={total}
          pageSize={20}
          basePath="/"
          nextPageLabel={t("nextPage", locale)}
        />
      </div>
    </HtmlDocument>
  );
};

interface TagPageProps {
  tagSlug: string;
  notes: Array<{
    id: string;
    title: string;
    excerpt: string;
    slug: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  acceptLanguage?: string | null;
  pageKey?: string;
}

export const TagPage: FC<TagPageProps> = ({
  tagSlug,
  notes,
  total,
  page,
  acceptLanguage,
  pageKey,
}) => {
  const locale = detectLocale(acceptLanguage);
  const heading = t("tag", locale, { slug: tagSlug });
  return (
    <HtmlDocument title={heading} locale={locale} pageKey={pageKey}>
      <div class="container">
        <h1>{heading}</h1>
        <div class="notes-list">
          {notes.length > 0 ? (
            notes.map((note) => (
              <NoteCard
                title={note.title}
                slug={note.slug ?? ""}
                id={note.id}
                excerpt={note.excerpt}
                publishedAt={note.publishedAt}
                createdAt={note.createdAt}
                locale={locale}
              />
            ))
          ) : (
            <p>{t("noNotes", locale)}</p>
          )}
        </div>
        <Pagination
          currentPage={page}
          total={total}
          pageSize={20}
          basePath={`/tag/${tagSlug}`}
          nextPageLabel={t("nextPage", locale)}
        />
      </div>
    </HtmlDocument>
  );
};

interface NoteDetailPageProps {
  note: {
    id: string;
    title: string;
    content: string;
    excerpt: string;
    slug: string | null;
    authorId: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    viewCount?: number;
    author?: { name: string | null } | null;
    tags?: Array<{ name: string; slug: string }> | null;
  };
  contentHtml: string;
  comments: Array<{
    id: string;
    authorName: string | null;
    content: string;
    createdAt: string;
  }>;
  acceptLanguage?: string | null;
  pageKey?: string;
}

interface CategoryPageProps {
  categorySlug: string;
  notes: Array<{
    id: string;
    title: string;
    excerpt: string;
    slug: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  acceptLanguage?: string | null;
  pageKey?: string;
}

export const CategoryPage: FC<CategoryPageProps> = ({
  categorySlug,
  notes,
  total,
  page,
  acceptLanguage,
  pageKey,
}) => {
  const locale = detectLocale(acceptLanguage);
  const categoryName = t(`category.${categorySlug}`, locale) || categorySlug;
  const heading = t("category", locale, { slug: categoryName });
  return (
    <HtmlDocument title={heading} locale={locale} pageKey={pageKey}>
      <div class="container">
        <h1>{heading}</h1>
        <div class="notes-list">
          {notes.length > 0 ? (
            notes.map((note) => (
              <NoteCard
                title={note.title}
                slug={note.slug ?? ""}
                id={note.id}
                excerpt={note.excerpt}
                publishedAt={note.publishedAt}
                createdAt={note.createdAt}
                locale={locale}
              />
            ))
          ) : (
            <p>{t("noNotes", locale)}</p>
          )}
        </div>
        <Pagination
          currentPage={page}
          total={total}
          pageSize={20}
          basePath={`/category/${categorySlug}`}
          nextPageLabel={t("nextPage", locale)}
        />
      </div>
    </HtmlDocument>
  );
};

export const NoteDetailPage: FC<NoteDetailPageProps> = ({
  note,
  contentHtml,
  comments,
  acceptLanguage,
  pageKey,
}) => {
  const locale = detectLocale(acceptLanguage);
  const tagsHtml = (note.tags ?? []).map((tag) => (
    <a href={`/tag/${tag.slug}`} class="tag">
      {tag.name}
    </a>
  ));

  const commentsHtml =
    comments.length > 0 ? (
      comments.map((c) => (
        <CommentItem
          authorName={c.authorName}
          content={c.content}
          createdAt={c.createdAt}
          locale={locale}
          anonymousLabel={t("anonymous", locale)}
        />
      ))
    ) : (
      <p class="no-comments">{t("noComments", locale)}</p>
    );

  return (
    <HtmlDocument
      title={note.title}
      locale={locale}
      description={note.excerpt}
      pageKey={pageKey}
      showReaderCount
    >
      <article class="note-detail">
        <header>
          <h1>{note.title}</h1>
          <div class="meta">
            <span class="author">{note.author?.name ?? t("anonymous", locale)}</span>
            <time datetime={note.publishedAt ?? ""}>
              {formatDate(note.publishedAt ?? note.createdAt, locale)}
            </time>
            {note.viewCount != null && note.viewCount > 0 && (
              <span style="margin-left:0.5rem;color:#9ca3af;font-size:0.8rem;">
                · {note.viewCount} 阅读
              </span>
            )}
          </div>
          <div class="tags">{tagsHtml}</div>
        </header>
        <div class="content prose" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        <section class="comments-section">
          <h2>{t("commentsHeading", locale, { count: String(comments.length) })}</h2>
          {commentsHtml}
        </section>
        <div
          id="comments-section"
          data-note-id={note.id}
          data-note-author-id={note.authorId ?? ""}
        />
      </article>
    </HtmlDocument>
  );
};

interface PreviewPageProps {
  note: {
    id: string;
    title: string;
    content: string;
    excerpt: string;
    updatedAt: string;
    author?: { name: string | null } | null;
    tags?: Array<{ name: string; slug: string }> | null;
  };
  contentHtml: string;
  acceptLanguage?: string | null;
  pageKey?: string;
}

export const PreviewPage: FC<PreviewPageProps> = ({
  note,
  contentHtml,
  acceptLanguage,
  pageKey,
}) => {
  const locale = detectLocale(acceptLanguage);
  const tagsHtml = (note.tags ?? []).map((tag) => (
    <a href={`/tag/${tag.slug}`} class="tag">
      {tag.name}
    </a>
  ));

  return (
    <HtmlDocument
      title={`${note.title} (${t("preview", locale)})`}
      locale={locale}
      description={note.excerpt}
      pageKey={pageKey}
    >
      <article class="note-detail preview">
        <div class="preview-badge">{t("previewMode", locale)}</div>
        <header>
          <h1>{note.title}</h1>
          <div class="meta">
            <span class="author">{note.author?.name ?? t("anonymous", locale)}</span>
            <time datetime={note.updatedAt}>{formatDate(note.updatedAt, locale)}</time>
          </div>
          <div class="tags">{tagsHtml}</div>
        </header>
        <div class="content prose" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </article>
    </HtmlDocument>
  );
};

interface ErrorPageProps {
  title: string;
  message: string;
  description?: string;
  acceptLanguage?: string | null;
}

export const ErrorPage: FC<ErrorPageProps> = ({ title, message, description, acceptLanguage }) => {
  const locale = detectLocale(acceptLanguage);
  return (
    <HtmlDocument title={title} locale={locale}>
      <h1>{message}</h1>
      {description && <p>{description}</p>}
    </HtmlDocument>
  );
};
