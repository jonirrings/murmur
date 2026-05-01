import { z } from "zod/v4";

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  noteId: z.string().min(1),
});

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reviewCommentSchema = z.object({
  authorApproved: z.boolean().optional(),
  adminHidden: z.boolean().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
export type ReviewCommentInput = z.infer<typeof reviewCommentSchema>;
