import { useState } from "react";
import { useComments } from "@/client/queries/comments";
import { useSession } from "@/client/lib/auth-client";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";

interface CommentListProps {
  noteId: string;
  isNoteAuthor?: boolean;
  isAdmin?: boolean;
}

export function CommentList({
  noteId,
  isNoteAuthor,
  isAdmin,
}: CommentListProps) {
  const [page, setPage] = useState(1);
  const { data: sessionData } = useSession();
  const { data, isLoading, isError } = useComments(noteId, page, 20);

  const currentUserId = sessionData?.user?.id;
  const isLoggedIn = !!sessionData?.user;

  const comments = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = comments.length < total;

  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-400">加载评论中...</div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-red-500">加载评论失败</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        评论 ({total})
      </h3>

      {isLoggedIn && (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <CommentForm noteId={noteId} />
        </div>
      )}

      {comments.length === 0 ? (
        <p className="py-4 text-center text-gray-400">暂无评论</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isNoteAuthor={isNoteAuthor}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="py-2 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}
