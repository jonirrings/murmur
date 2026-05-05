import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import { sendMagicLinkEmail } from "@/services/email.service";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export function createAuth(db: Database, env: AuthEnv) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        passkey: schema.passkey,
        twoFactor: schema.twoFactor,
      },
    }),
    socialProviders: env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : undefined,
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          try {
            if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
              const result = await sendMagicLinkEmail(
                { to: email, url, token },
                env.RESEND_API_KEY,
                env.RESEND_FROM_EMAIL,
              );
              if (!result.success) {
                console.error(`[auth] Failed to send magic link to ${email}: ${result.error}`);
              }
            } else {
              // Dev fallback: log to console
              console.log(`[auth] Magic link for ${email}: ${url}?token=${token}`);
            }
          } catch (err) {
            console.error(`[auth] sendMagicLink error:`, err);
          }
        },
      }),
      admin(),
      passkey({
        rpID: env.RP_ID,
        rpName: "Murmur",
        origin: env.ORIGIN,
      }),
      twoFactor({
        otpOptions: { period: 3 },
      }),
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
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Check if this user has an OAuth account (GitHub etc.)
            // OAuth users are auto-approved since their email is verified by the provider
            const accounts = await db
              .select({ providerId: schema.account.providerId })
              .from(schema.account)
              .where(eq(schema.account.userId, user.id))
              .all();

            const hasOAuthAccount = accounts.some(
              (a) => a.providerId !== "magic-link" && a.providerId !== "credential",
            );

            if (hasOAuthAccount) {
              await db
                .update(schema.user)
                .set({ approvalStatus: "approved", updatedAt: new Date().toISOString() })
                .where(eq(schema.user.id, user.id))
                .run();
            }
          },
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
  ASSETS: Fetcher;
  COLLAB_DO: DurableObjectNamespace;
  RATE_LIMITER_DO: DurableObjectNamespace;
  VISITOR_COUNTER_DO: DurableObjectNamespace;
  RP_ID: string;
  ORIGIN: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
};
