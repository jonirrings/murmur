import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { useMyNotes, usePublishNote, useUnpublishNote, useDeleteNote } from "@/client/lib/notes";
import { formatDateLocale } from "@/client/lib/relative-time";
import type { NoteCategory } from "@/shared/types";

export function AdminNotes() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<"draft" | "published" | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | undefined>(undefined);

  const { data, isLoading } = useMyNotes({
    page,
    limit: 20,
    status: filterStatus,
    category: filterCategory,
  });
  const publishNote = usePublishNote();
  const unpublishNote = useUnpublishNote();
  const deleteNote = useDeleteNote();
  const navigate = useNavigate();
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  const notes = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(i18next.t("admin:notes.deleteConfirm", { title }))) {
      deleteNote.mutate(id);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("notes.title")}</h2>
        <button
          onClick={() => navigate({ to: "/admin/notes/new" })}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {tc("actions.create")}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-4">
        <select
          value={filterStatus ?? ""}
          onChange={(e) => {
            setFilterStatus((e.target.value as "draft" | "published" | undefined) || undefined);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{tc("status.allStatus")}</option>
          <option value="draft">{tc("status.draft")}</option>
          <option value="published">{tc("status.published")}</option>
        </select>

        <select
          value={filterCategory ?? ""}
          onChange={(e) => {
            setFilterCategory((e.target.value as NoteCategory | undefined) || undefined);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{tc("category.all")}</option>
          <option value="note">{tc("category.note")}</option>
          <option value="inspiration">{tc("category.inspiration")}</option>
          <option value="tip">{tc("category.tip")}</option>
          <option value="knowledge">{tc("category.knowledge")}</option>
        </select>

        <span className="text-sm text-gray-500">
          {tc("pagination.totalNotes", { count: total })}
        </span>
      </div>

      {isLoading ? (
        <p className="text-gray-400">{tc("app.loading")}</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{t("notes.empty")}</p>
          <button
            onClick={() => navigate({ to: "/admin/notes/new" })}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("notes.emptyAction")}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 px-3 text-left font-medium text-gray-500">
                  {t("notes.tableTitle")}
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">
                  {t("notes.tableCategory")}
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">
                  {t("notes.tableStatus")}
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">
                  {t("notes.tableWordCount")}
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">
                  {t("notes.tableUpdatedAt")}
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">
                  {t("notes.tableActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3">
                    <button
                      onClick={() =>
                        navigate({ to: "/admin/notes/$id/edit", params: { id: note.id } })
                      }
                      className="text-left text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {note.title || tc("noTitle")}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                    {tc(`category.${note.category}`)}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        note.status === "published"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {note.status === "published" ? tc("status.published") : tc("status.draft")}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{note.wordCount}</td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                    {formatDateLocale(note.updatedAt)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          navigate({ to: "/admin/notes/$id/edit", params: { id: note.id } })
                        }
                        className="rounded px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                      >
                        {tc("actions.edit")}
                      </button>
                      {note.status === "draft" ? (
                        <button
                          onClick={() => publishNote.mutate({ id: note.id })}
                          disabled={publishNote.isPending}
                          className="rounded px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 dark:text-green-300 dark:bg-green-900/30"
                        >
                          {tc("actions.publish")}
                        </button>
                      ) : (
                        <button
                          onClick={() => unpublishNote.mutate(note.id)}
                          disabled={unpublishNote.isPending}
                          className="rounded px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 dark:text-yellow-300 dark:bg-yellow-900/30"
                        >
                          {tc("actions.unpublish")}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(note.id, note.title)}
                        disabled={deleteNote.isPending}
                        className="rounded px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 dark:text-red-300 dark:bg-red-900/30"
                      >
                        {tc("actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
