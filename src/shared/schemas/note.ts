import { z } from "zod/v4";

export const NOTE_CATEGORIES = ["note", "inspiration", "tip", "knowledge"] as const;
export const NOTE_STATUSES = ["draft", "published"] as const;

export const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(1_000_000),
  category: z.enum(NOTE_CATEGORIES).default("note"),
  tagIds: z.array(z.string()).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(1_000_000).optional(),
  category: z.enum(NOTE_CATEGORIES).optional(),
  excerpt: z.string().max(500).optional(),
  tagIds: z.array(z.string()).optional(),
});

export const publishNoteSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
});

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(NOTE_STATUSES).optional(),
  category: z.enum(NOTE_CATEGORIES).optional(),
  tag: z.string().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type PublishNoteInput = z.infer<typeof publishNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
