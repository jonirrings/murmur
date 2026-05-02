import { createFileRoute } from "@tanstack/react-router";
import { NoteEditorPage } from "@/client/pages/admin/editor";

export const Route = createFileRoute("/admin/notes/$id/edit")({
  component: NoteEditorPage,
});
