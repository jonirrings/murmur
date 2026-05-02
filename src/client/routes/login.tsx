import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/client/pages/login";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
