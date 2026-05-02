import { createFileRoute } from "@tanstack/react-router";
import { NoteEditorPage } from "@/client/pages/admin/editor";

export const Route = createFileRoute("/admin/notes/new")({
  component: NoteEditorPage,
});
