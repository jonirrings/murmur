import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  useNote,
  useCreateNote,
  useUpdateNote,
  usePublishNote,
  useUnpublishNote,
} from "@/client/lib/notes";
import { LazyMarkdownEditor, Toolbar, CollabPresence } from "@/client/components/editor";
import type { MarkdownEditorHandle } from "@/client/components/editor";
import { renderMarkdown } from "@/client/lib/markdown";
import { formatDateLocale } from "@/client/lib/relative-time";
import { useAutoSave } from "@/client/hooks/useAutoSave";
import { useCollabEditor } from "@/client/hooks/useCollabEditor";
import type { NoteCategory } from "@/shared/types";

export function NoteEditorPage() {
  const { id } = useParams({ strict: false });
  const isNew = !id;
  const navigate = useNavigate();
  const { t } = useTranslation("editor");
  const { t: tc } = useTranslation("common");

  const { data: existingNote, isLoading } = useNote(id ?? "");
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const publishNote = usePublishNote();
  const unpublishNote = useUnpublishNote();
  const {
    collabExtensions,
    isConnected: isCollabConnected,
    participants,
    wsLatency,
    rtcLatency,
    isP2P,
  } = useCollabEditor(isNew ? null : (id ?? null), existingNote?.author?.name ?? undefined);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NoteCategory>("note");
  const [slug, setSlug] = useState("");
  const [noteId, setNoteId] = useState<string | null>(id ?? null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const editorRef = useRef<MarkdownEditorHandle>(null);

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title);
      setContent(existingNote.content);
      setCategory(existingNote.category);
      setSlug(existingNote.slug ?? "");
    }
  }, [existingNote]);

  // Render preview
  useEffect(() => {
    if (!showPreview) return;
    let cancelled = false;
    void renderMarkdown(content).then((html) => {
      if (!cancelled) setPreviewHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [content, showPreview]);

  const categoryOptions: { value: NoteCategory; labelKey: string }[] = [
    { value: "note", labelKey: "category.note" },
    { value: "inspiration", labelKey: "category.inspiration" },
    { value: "tip", labelKey: "category.tip" },
    { value: "knowledge", labelKey: "category.knowledge" },
  ];

  const saveNote = useCallback(
    async (data: {
      title: string;
      content: string;
      category: NoteCategory;
      noteId: string | null;
    }) => {
      if (!data.title.trim() && !data.content.trim()) return;

      if (data.noteId) {
        await updateNote.mutateAsync({
          id: data.noteId,
          title: data.title.trim() || tc("noTitle"),
          content: data.content,
          category: data.category,
        });
      } else {
        const result = await createNote.mutateAsync({
          title: data.title.trim() || tc("noTitle"),
          content: data.content,
          category: data.category,
        });
        setNoteId(result.id);
        void navigate({ to: "/admin/notes/$id/edit", params: { id: result.id }, replace: true });
      }
    },
    [updateNote, createNote, navigate, tc],
  );

  const { isSaving, lastSaved, save } = useAutoSave({
    data: { title, content, category, noteId },
    saveFn: saveNote,
    enabled: !(isNew && !title.trim() && !content.trim()),
  });

  const handlePublish = async () => {
    if (!noteId) return;
    await save();
    publishNote.mutate({ id: noteId, slug: slug.trim() || undefined });
  };

  const handleUnpublish = async () => {
    if (!noteId) return;
    unpublishNote.mutate(noteId);
  };

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-400">{tc("app.loading")}</p>
      </div>
    );
  }

  const isPublished = existingNote?.status === "published";

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3 mb-3 gap-2 dark:border-gray-700">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => navigate({ to: "/admin/notes" })}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 whitespace-nowrap"
          >
            &larr; {tc("actions.back")}
          </button>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as NoteCategory)}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {tc(c.labelKey)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`rounded px-2 py-1 text-sm whitespace-nowrap ${showPreview ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
          >
            {showPreview ? t("editor.editMode") : t("editor.previewMode")}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSaving && <span className="text-xs text-gray-400">{tc("actions.saving")}</span>}
          {!isNew && id && (
            <CollabPresence
              isConnected={isCollabConnected}
              participants={participants}
              wsLatency={wsLatency}
              rtcLatency={rtcLatency}
              isP2P={isP2P}
            />
          )}
          {lastSaved && !isSaving && (
            <span className="text-xs text-gray-400">
              {tc("actions.saved")}{" "}
              {formatDateLocale(lastSaved.toISOString(), { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {noteId && isPublished && (
            <button
              onClick={handleUnpublish}
              disabled={unpublishNote.isPending}
              className="rounded px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 dark:text-yellow-300 dark:bg-yellow-900/30"
            >
              {tc("actions.unpublish")}
            </button>
          )}
          {noteId && !isPublished && (
            <button
              onClick={handlePublish}
              disabled={publishNote.isPending}
              className="rounded px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 dark:text-green-300 dark:bg-green-900/30"
            >
              {tc("actions.publish")}
            </button>
          )}
          <button
            onClick={save}
            disabled={isSaving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {tc("actions.save")}
          </button>
        </div>
      </div>

      {/* Mobile floating save button */}
      <button
        onClick={save}
        disabled={isSaving}
        className="fixed bottom-4 right-4 z-50 sm:hidden rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700 disabled:opacity-50"
        aria-label={tc("actions.save")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
          <path
            fillRule="evenodd"
            d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("editor.titlePlaceholder")}
        className="w-full text-2xl font-bold border-none outline-none mb-1 bg-transparent text-gray-900 placeholder-gray-300 dark:text-white dark:placeholder-gray-600"
      />

      {/* Slug */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-400 whitespace-nowrap">{t("editor.slugLabel")}</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100))}
          placeholder={t("editor.slugPlaceholder")}
          className="flex-1 text-sm border-none outline-none bg-transparent text-gray-500 placeholder-gray-300 dark:text-gray-400 dark:placeholder-gray-600 font-mono"
        />
        {slug && <span className="text-xs text-gray-400">/note/{slug}</span>}
      </div>

      {/* Editor / Preview */}
      {showPreview ? (
        <div
          className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 prose max-w-none"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <div className="flex-1 flex flex-col rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700">
          <Toolbar editorView={editorRef.current?.getView() ?? null} />
          <div className="flex-1 overflow-hidden">
            <Suspense
              fallback={<div className="flex-1 animate-pulse bg-gray-100 dark:bg-gray-800" />}
            >
              <LazyMarkdownEditor
                collabExtensions={collabExtensions}
                ref={editorRef}
                value={content}
                onChange={setContent}
                placeholder={t("editor.contentPlaceholder")}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
