import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [{ title: "Murmur/碎碎念" }, { name: "description", content: "记录一些技术探索记录" }],
    links: [{ rel: "alternate", type: "application/atom+xml", href: "/feed.xml" }],
  }),
});

function Home() {
  return (
    <div class="p-8">
      <h1 class="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p class="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
    </div>
  );
}
