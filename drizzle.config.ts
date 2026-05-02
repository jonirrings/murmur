import { defineConfig } from "drizzle-kit";
import { readdirSync } from "fs";

const d1Dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
let dbUrl: string | undefined;
try {
  const files = readdirSync(d1Dir);
  const dbFile = files.find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (dbFile) dbUrl = `${d1Dir}/${dbFile}`;
} catch {}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  ...(dbUrl ? { dbCredentials: { url: dbUrl } } : {}),
});
