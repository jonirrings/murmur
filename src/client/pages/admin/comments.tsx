import { useState } from "react";
import { useAdminComments, useReviewComment } from "@/client/queries/comments";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "@/client/lib/relative-time";

export function AdminComments() {
  const [page, setPage] = useState(1);
  const [filterApproved, setFilterApproved] = useState<number | undefined>(undefined);
  const [filterHidden, setFilterHidden] = useState<number | undefined>(undefined);

  const { data, isLoading } = useAdminComments({
    page,
    limit: 20,
    authorApproved: filterApproved,
    adminHidden: filterHidden,
  });
  const reviewComment = useReviewComment();
  const { t } = useTranslation("comments");
  const { t: tc } = useTranslation("common");

  const comments = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        {t("admin.title")}
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-4">
        <select
          value={filterApproved ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setFilterApproved(v === "" ? undefined : Number(v));
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{tc("status.allApproval")}</option>
          <option value="0">{tc("status.pending")}</option>
          <option value="1">{tc("status.approved")}</option>
        </select>

        <select
          value={filterHidden ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setFilterHidden(v === "" ? undefined : Number(v));
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{tc("status.allVisibility")}</option>
          <option value="0">{tc("status.normal")}</option>
          <option value="1">{tc("status.hidden")}</option>
        </select>

        <span className="text-sm text-gray-500">
          {tc("pagination.totalComments", { count: total })}
        </span>
      </div>

      {isLoading ? (
        <p className="text-gray-400">{tc("app.loading")}</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-400">{t("list.empty")}</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {comment.authorName ?? tc("anonymous")}
                    </span>
                    {comment.authorApproved === 0 && (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                        {t("item.pending")}
                      </span>
                    )}
                    {comment.adminHidden === 1 && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                        {t("item.hidden")}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                    {comment.content}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("admin.noteLabel")} {comment.noteId}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  {comment.authorApproved === 0 && (
                    <>
                      <button
                        onClick={() =>
                          reviewComment.mutate({
                            id: comment.id,
                            authorApproved: true,
                          })
                        }
                        disabled={reviewComment.isPending}
                        className="rounded px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50"
                      >
                        {t("review.approve")}
                      </button>
                      <button
                        onClick={() =>
                          reviewComment.mutate({
                            id: comment.id,
                            authorApproved: false,
                          })
                        }
                        disabled={reviewComment.isPending}
                        className="rounded px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50"
                      >
                        {t("review.reject")}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      reviewComment.mutate({
                        id: comment.id,
                        adminHidden: comment.adminHidden === 1 ? false : true,
                      })
                    }
                    disabled={reviewComment.isPending}
                    className={`rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                      comment.adminHidden === 1
                        ? "text-blue-700 bg-blue-100 hover:bg-blue-200"
                        : "text-orange-700 bg-orange-100 hover:bg-orange-200"
                    }`}
                  >
                    {comment.adminHidden === 1 ? t("review.unhide") : t("review.hide")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            {tc("actions.previous")}
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            {tc("actions.next")}
          </button>
        </div>
      )}
    </div>
  );
}
