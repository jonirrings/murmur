import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as process from "node:process";

const db = drizzle(env.DB, { schema, logger: process.env.NODE_ENV === "development" });

export default db;
