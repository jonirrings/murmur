import { createFileRoute } from "@tanstack/react-router";
import { AdminUserDetail } from "@/client/pages/admin/user-detail";

export const Route = createFileRoute("/admin/users/$userId")({
  component: AdminUserDetail,
});
