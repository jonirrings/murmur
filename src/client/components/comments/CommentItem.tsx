import type { Comment } from "@/client/queries/comments";
import { useDeleteComment } from "@/client/queries/comments";
import { CommentReview } from "./CommentReview";

interface CommentItemProps {
  comment: Comment;
  isNoteAuthor?: boolean;
  isAdmin?: boolean;
  currentUserId?: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString("zh-CN");
}

export function CommentItem({
  comment,
  isNoteAuthor,
  isAdmin,
  currentUserId,
}: CommentItemProps) {
  const deleteComment = useDeleteComment();
  const canDelete = currentUserId === comment.authorId || isAdmin;

  return (
    <div className="border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {comment.authorImage ? (
            <img
              src={comment.authorImage}
              alt=""
              className="h-8 w-8 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
              {comment.authorName?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {comment.authorName ?? "匿名用户"}
              </span>
              {comment.authorApproved === 0 && (
                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                  待审核
                </span>
              )}
              {comment.adminHidden === 1 && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                  已隐藏
                </span>
              )}
              <span className="text-xs text-gray-400">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <CommentReview
            commentId={comment.id}
            authorApproved={comment.authorApproved}
            adminHidden={comment.adminHidden}
            isNoteAuthor={isNoteAuthor ?? false}
            isAdmin={isAdmin ?? false}
          />
          {canDelete && (
            <button
              onClick={() => deleteComment.mutate(comment.id)}
              disabled={deleteComment.isPending}
              className="rounded px-2 py-0.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
