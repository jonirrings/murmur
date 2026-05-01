import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";
import type { Env } from "@/auth/middleware";
import { requireAdmin } from "@/auth/middleware";

const app = new Hono<Env>();

const SETTINGS_PREFIX = "settings:";

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.string()),
});

/** GET /api/admin/settings — Get all settings */
app.get("/", requireAdmin, async (c) => {
  const kv = c.env.KV;
  const list = await kv.list({ prefix: SETTINGS_PREFIX });
  const settings: Record<string, string> = {};
  for (const key of list.keys) {
    const value = await kv.get(key.name);
    if (value !== null) {
      settings[key.name.slice(SETTINGS_PREFIX.length)] = value;
    }
  }
  return c.json({ data: settings });
});

/** PATCH /api/admin/settings — Update settings */
app.patch(
  "/",
  requireAdmin,
  zValidator("json", updateSettingsSchema),
  async (c) => {
    const { settings } = c.req.valid("json");
    const kv = c.env.KV;

    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        kv.put(`${SETTINGS_PREFIX}${key}`, value),
      ),
    );

    return c.json({ data: { ok: true } });
  },
);

export default app;
