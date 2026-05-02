import { createFileRoute } from "@tanstack/react-router";
import { AdminComments } from "@/client/pages/admin/comments";

export const Route = createFileRoute("/admin/comments")({
  component: AdminComments,
});
