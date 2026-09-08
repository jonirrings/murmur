import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as process from "node:process";
import type { AppEnv } from "../types";

const db = drizzle((env as unknown as AppEnv["Bindings"]).DB, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export default db;
