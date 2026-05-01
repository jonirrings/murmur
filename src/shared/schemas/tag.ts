import { z } from "zod/v4";

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
