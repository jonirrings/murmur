// apps/api/src/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "../db";

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    debugLogs: process.env.NODE_ENV === "development",
  }),
});
