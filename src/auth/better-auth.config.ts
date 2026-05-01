import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { admin } from "better-auth/plugins/admin";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";

export function createAuth(db: Database, env: AuthEnv) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          // TODO: integrate Resend API for email delivery
          console.log(`Magic link for ${email}: ${url}?token=${token}`);
        },
      }),
      admin(),
    ],
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.ORIGIN],
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "commenter",
          input: false,
        },
        approvalStatus: {
          type: "string",
          defaultValue: "pending",
          input: false,
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthEnv = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  COLLAB_DO: DurableObjectNamespace;
  RATE_LIMITER_DO: DurableObjectNamespace;
  RP_ID: string;
  ORIGIN: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};
