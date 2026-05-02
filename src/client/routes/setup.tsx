import { createFileRoute } from "@tanstack/react-router";
import { SetupPage } from "@/client/pages/setup";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});
