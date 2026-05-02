import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { SearchService } from "@/services/search.service";

const app = new Hono<Env>();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.enum(["note", "inspiration", "tip", "knowledge"]).optional(),
  tag: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /api/search — Search published notes */
app.get("/", zValidator("query", searchQuerySchema), async (c) => {
  const params = c.req.valid("query");
  const db = createDb(c.env.DB);
  const service = new SearchService(db);
  const result = await service.search({
    query: params.q,
    category: params.category,
    tag: params.tag,
    page: params.page,
    limit: params.limit,
  });
  return c.json({ data: result });
});

export default app;
