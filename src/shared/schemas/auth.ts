import { z } from "zod/v4";

export const setupAdminSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
});

export const magicLinkSchema = z.object({
  email: z.email(),
});

export const turnstileSchema = z.object({
  turnstileToken: z.string().min(1),
});
