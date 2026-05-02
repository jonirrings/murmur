import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import type { Env } from "@/auth/middleware";
import { createDb } from "@/db/client";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SetupService } from "@/services/setup.service";
import { UserRepo } from "@/db/repositories/user.repo";
import { createAuth } from "@/auth/better-auth.config";

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
    return c.json({ error: { code: "CONFLICT", message: "管理员已存在，无法重复初始化" } }, 409);
  }

  const { name, email } = c.req.valid("json");

  // Use better-auth to create the user, then promote to admin
  const auth = createAuth(db, c.env);
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
    // Create user via better-auth admin API
    const result = await auth.api.createUser({
      body: {
        email,
        name,
        role: "admin",
      },
    });
    userId = result.user.id;

    // Set approval status via Drizzle (better-auth doesn't manage this field)
    await db
      .update(user)
      .set({
        approvalStatus: "approved",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, userId))
      .run();
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
