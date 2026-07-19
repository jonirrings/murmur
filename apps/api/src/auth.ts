// apps/api/src/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

export function createAuth(d1Binding: D1Database) {
    const db = drizzle(d1Binding);
    return betterAuth({
        database: drizzleAdapter(db, { provider: "sqlite" }),
        emailAndPassword: { enabled: true },
    });
}
