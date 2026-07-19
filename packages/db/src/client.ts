import type { D1Database } from "@cloudflare/workers-types";

// ─── Runtime 类型标记（编译时消除） ───
// drizzle-orm/d1 和 drizzle-orm/better-sqlite3 不会同时出现在运行时。
// 通过条件导入 + 类型断言让 TypeScript 和打包器都满意。

// ─── D1 客户端（Worker 运行时 + wrangler dev miniflare） ───
export async function createDb(d1Binding: D1Database) {
  const { drizzle } = await import("drizzle-orm/d1");
  const schema = await import("./schema");
  return drizzle(d1Binding, { schema: { ...schema } });
}

// ─── 本地 SQLite 客户端（独立脚本 / 测试 / seed） ───
export async function createLocalDb(path?: string) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("./schema");

  const dbPath = path || process.env.LOCAL_DB_URL || "./local.db";
  const sqlite = new Database(dbPath);
  return drizzle(sqlite, { schema: { ...schema } });
}
