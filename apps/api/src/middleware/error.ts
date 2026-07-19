import type { Context, Next } from "hono";

export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (err) {
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
}
