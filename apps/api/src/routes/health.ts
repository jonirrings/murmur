import type { Context } from "hono";
import db from "../db";
import * as process from "node:process";

// 不标注 Promise<Response>，让 hono 推导 TypedResponse，
// 否则 hc client 端的 .json() 会退化为 Promise<unknown>
export async function health(c: Context) {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: await checkDatabase(),
    version: process.env.npm_package_version,
  };
  return c.json(checks);
}
async function checkDatabase() {
  try {
    const start = performance.now();
    await db.run("SELECT 1");
    const latencyMs = performance.now() - start;
    return { status: "connected", latency: latencyMs };
  } catch (error) {
    return { status: "error", error: (error as any).message };
  }
}
