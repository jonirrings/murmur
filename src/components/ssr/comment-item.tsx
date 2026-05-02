/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { formatDate } from "./layout";

interface CommentItemProps {
  authorName: string | null;
  content: string;
  createdAt: string;
  locale: string;
  anonymousLabel: string;
}

export const CommentItem: FC<CommentItemProps> = ({
  authorName,
  content,
  createdAt,
  locale,
  anonymousLabel,
}) => {
  return (
    <div class="comment">
      <div class="comment-header">
        <span class="comment-author">{authorName ?? anonymousLabel}</span>
        <time datetime={createdAt}>{formatDate(createdAt, locale)}</time>
      </div>
      <p class="comment-content">{content}</p>
    </div>
  );
};
