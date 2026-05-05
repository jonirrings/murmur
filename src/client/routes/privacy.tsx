import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/client/pages/privacy";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});
