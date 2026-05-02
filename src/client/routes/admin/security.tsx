import { createFileRoute } from "@tanstack/react-router";
import { AdminSecurity } from "@/client/pages/admin/security";

export const Route = createFileRoute("/admin/security")({
  component: AdminSecurity,
});
