import { useReviewComment } from "@/client/queries/comments";
import { useTranslation } from "react-i18next";

interface CommentReviewProps {
  commentId: string;
  authorApproved: number;
  adminHidden: number;
  isNoteAuthor: boolean;
  isAdmin: boolean;
}

export function CommentReview({
  commentId,
  authorApproved,
  adminHidden,
  isNoteAuthor,
  isAdmin,
}: CommentReviewProps) {
  const reviewComment = useReviewComment();
  const { t } = useTranslation("comments");

  if (!isNoteAuthor && !isAdmin) return null;

  return (
    <div className="flex items-center gap-2">
      {isNoteAuthor && authorApproved === 0 && (
        <>
          <button
            onClick={() => reviewComment.mutate({ id: commentId, authorApproved: true })}
            disabled={reviewComment.isPending}
            className="rounded px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50"
          >
            {t("review.approve")}
          </button>
          <button
            onClick={() => reviewComment.mutate({ id: commentId, authorApproved: false })}
            disabled={reviewComment.isPending}
            className="rounded px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50"
          >
            {t("review.reject")}
          </button>
        </>
      )}
      {isAdmin && (
        <button
          onClick={() =>
            reviewComment.mutate({
              id: commentId,
              adminHidden: adminHidden === 1 ? false : true,
            })
          }
          disabled={reviewComment.isPending}
          className={`rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
            adminHidden === 1
              ? "text-blue-700 bg-blue-100 hover:bg-blue-200"
              : "text-orange-700 bg-orange-100 hover:bg-orange-200"
          }`}
        >
          {adminHidden === 1 ? t("review.unhide") : t("review.hide")}
        </button>
      )}
    </div>
  );
}
