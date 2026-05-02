import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminNotes } from "@/client/pages/admin/notes";

export const Route = createFileRoute("/admin/notes")({
  component: () => (
    <>
      <AdminNotes />
      <Outlet />
    </>
  ),
});
