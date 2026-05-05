import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import type { Env } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SetupService } from "@/services/setup.service";
import { UserRepo } from "@/db/repositories/user.repo";
import { t } from "@/shared/i18n/server";

const app = new Hono<Env>();

const setupAdminSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
});

/** GET /api/setup/status — Check if OOBE setup is needed */
app.get("/status", async (c) => {
  const db = createDb(c.env.DB);
  const service = new SetupService(db);
  const complete = await service.isSetupComplete();
  return c.json({ data: { setupComplete: complete } });
});

/** POST /api/setup/admin — Create the initial admin (OOBE) */
app.post("/admin", zValidator("json", setupAdminSchema), async (c) => {
  const db = createDb(c.env.DB);
  const service = new SetupService(db);

  // Block if admin already exists
  const alreadySetup = await service.isSetupComplete();
  if (alreadySetup) {
    return c.json(
      { error: { code: "CONFLICT", message: t("error.adminAlreadyExists", c.get("language")) } },
      409,
    );
  }

  const { name, email } = c.req.valid("json");
  const existingUser = await new UserRepo(db).findByEmail(email);

  let userId: string;

  if (existingUser) {
    // Promote existing user to admin
    await db
      .update(user)
      .set({
        role: "admin",
        approvalStatus: "approved",
        name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, existingUser.id))
      .run();
    userId = existingUser.id;
  } else {
    // Create admin user directly via Drizzle (bypasses better-auth admin session requirement)
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .insert(user)
      .values({
        id,
        email,
        emailVerified: false,
        name,
        createdAt: now,
        updatedAt: now,
        role: "admin",
        approvalStatus: "approved",
        twoFactorEnabled: false,
      })
      .run();
    userId = id;
  }

  return c.json(
    {
      data: {
        id: userId,
        email,
        name,
        role: "admin",
        approvalStatus: "approved",
      },
    },
    201,
  );
});

export default app;
