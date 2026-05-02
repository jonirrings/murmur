import { createFileRoute } from "@tanstack/react-router";
import { AdminUsers } from "@/client/pages/admin/users";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});
