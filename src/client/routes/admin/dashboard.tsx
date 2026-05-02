import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/client/pages/admin/dashboard";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});
