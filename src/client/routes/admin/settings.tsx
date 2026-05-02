import { createFileRoute } from "@tanstack/react-router";
import { AdminSettings } from "@/client/pages/admin/settings";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});
