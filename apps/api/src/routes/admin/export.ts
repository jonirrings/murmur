import { Hono } from "hono";

export const adminExport = new Hono().get("/", async (c) => {
  return c.json(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      snippets: [],
      tags: [],
      snippetsToTags: [],
    },
    200,
    {
      "Content-Disposition": `attachment; filename="murmur-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  );
});
