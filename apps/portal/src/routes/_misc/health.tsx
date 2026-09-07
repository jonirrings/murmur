import { createFileRoute } from "@tanstack/solid-router";
import { healthStatus } from "~/lib/misc.functions.ts";

export const Route = createFileRoute("/_misc/health")({
  loader: () => healthStatus(),
  component: RouteComponent,
});

function RouteComponent() {
  const status = Route.useLoaderData();
  return (
    <div>
      Hello "/_misc/health"!
      <section>{JSON.stringify(status())}</section>
    </div>
  );
}
