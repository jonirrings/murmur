import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorView } from "@codemirror/view";

interface ImageUploaderProps {
  editorView: EditorView | null;
}

export function ImageUploader({ editorView }: ImageUploaderProps) {
  const { t } = useTranslation("editor");
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!editorView) return;

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/attachments", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        const { data } = (await res.json()) as {
          data: { id: string; filename: string };
        };

        // Insert markdown image syntax at cursor
        const cursor = editorView.state.selection.main.head;
        const imageMd = `\n![${file.name}](/api/attachments/${data.id})\n`;
        editorView.dispatch({
          changes: { from: cursor, insert: imageMd },
        });
        editorView.focus();
      } catch (err) {
        console.error("Image upload failed:", err);
        alert(t("image.uploadFailed"));
      } finally {
        setIsUploading(false);
      }
    },
    [editorView],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void uploadImage(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [uploadImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        void uploadImage(file);
      }
    },
    [uploadImage],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        title={t("image.uploadTitle")}
        disabled={!editorView || isUploading}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        {isUploading ? "⏳" : "🖼"}
      </button>
    </>
  );
}

/**
 * Creates a CodeMirror extension that handles image paste/drop.
 */
export function imagePasteExtension(uploadCallback: (file: File) => void) {
  return EditorView.domEventHandlers({
    paste(event) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) uploadCallback(file);
          return true;
        }
      }
      return false;
    },
    drop(event) {
      const file = event.dataTransfer?.files[0];
      if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        uploadCallback(file);
        return true;
      }
      return false;
    },
  });
}
