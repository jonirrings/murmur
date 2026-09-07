import { Hono } from "hono";

export const adminStats = new Hono().get("/", async (c) => {
  return c.json({
    totalSnippets: 0,
    publishedSnippets: 0,
    draftSnippets: 0,
    archivedSnippets: 0,
    totalTags: 0,
    recentActivity: [],
  });
});
