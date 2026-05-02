/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { formatDate } from "./layout";

interface NoteCardProps {
  title: string;
  slug: string;
  id: string;
  excerpt: string;
  publishedAt: string | null;
  createdAt: string;
  locale: string;
}

export const NoteCard: FC<NoteCardProps> = ({
  title,
  slug,
  id,
  excerpt,
  publishedAt,
  createdAt,
  locale,
}) => {
  return (
    <article class="note-card">
      <h2>
        <a href={`/note/${slug || id}`}>{title}</a>
      </h2>
      <p class="excerpt">{excerpt}</p>
      <time datetime={publishedAt ?? ""}>{formatDate(publishedAt ?? createdAt, locale)}</time>
    </article>
  );
};
