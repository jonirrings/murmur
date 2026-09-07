import { defineConfig } from "drizzle-kit";
import * as process from "node:process";

const remoteConfig = defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  // only for remote
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID,
    token: process.env.CLOUDFLARE_D1_TOKEN,
  },
});

const localConfig = defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  // only for local migration files generation
  dbCredentials: {
    url: "./local-dev.db",
  },
});

export default process.env.NODE_ENV === "production" ? remoteConfig : localConfig;
