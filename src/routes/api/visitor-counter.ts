import { Hono } from "hono";
import type { Env } from "@/auth/middleware";

const app = new Hono<Env>();

/** GET /ws?pageKey= — WebSocket upgrade for visitor counter */
app.get("/ws", async (c) => {
  const doId = c.env.VISITOR_COUNTER_DO.idFromName("global");
  const stub = c.env.VISITOR_COUNTER_DO.get(doId);
  return stub.fetch(c.req.raw);
});

/** GET /counts — Get all page visitor counts */
app.get("/counts", async (c) => {
  const doId = c.env.VISITOR_COUNTER_DO.idFromName("global");
  const stub = c.env.VISITOR_COUNTER_DO.get(doId);
  return stub.fetch(new Request("https://do/counts"));
});

/** GET /count?pageKey= — Get visitor count for a specific page */
app.get("/count", async (c) => {
  const pageKey = c.req.query("pageKey") || "/";
  const doId = c.env.VISITOR_COUNTER_DO.idFromName("global");
  const stub = c.env.VISITOR_COUNTER_DO.get(doId);
  return stub.fetch(new Request(`https://do/count?pageKey=${encodeURIComponent(pageKey)}`));
});

export default app;
