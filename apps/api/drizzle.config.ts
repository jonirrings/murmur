import { defineConfig } from "drizzle-kit";

const isProd = process.env.NODE_NEV === "production";

export default defineConfig({
  schema: "../../packages/db/src/schema.ts",
  out: "./migrations",
  dialect: "sqlite", // D1 兼容 SQLite
  driver: "d1-http", // 使用 D1 HTTP API（本地用 Miniflare 模拟）
  dbCredentials: isProd
    ? {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
        token: process.env.CLOUDFLARE_D1_TOKEN!,
      }
    : { url: "http://localhost:8787" },
});
