import type { Context, Next } from "hono";

export async function contentSignal(c: Context, next: Next): Promise<void> {
  await next();
  if (c.res.status === 200) {
    c.res.headers.set("Content-Signal", "ai-train=yes, search=yes, ai-input=yes");
  }
}
