import { z } from "zod";

// ─── 枚举常量（前后端共用） ───
export const snippetStatuses = ["draft", "published", "archived"] as const;
export const snippetVisibilities = ["public", "unlisted", "private"] as const;

// ─── 认证 ───
export const signInSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("请输入有效的邮箱"),
  password: z.string().min(1, "请输入密码"),
});

export const signUpSchema = z.object({
  name: z.string().min(1, "请输入昵称"),
  email: z.string().min(1, "请输入邮箱").email("请输入有效的邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
});

// ─── 标签 ───
export const tagSchema = z.object({
  slug: z
    .string()
    .min(1, "slug 不能为空")
    .regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字和连字符"),
  name: z.string().min(1, "名称不能为空"),
  description: z.string().nullish(),
  color: z.string().nullish(),
});

// ─── 碎片 ───
export const snippetSchema = z.object({
  slug: z.string().optional(),
  title: z.string().min(1, "标题不能为空"),
  contentMd: z.string().min(1, "正文不能为空"),
  excerpt: z.string().nullish(),
  language: z.string().nullish(),
  coverImage: z.string().nullish(),
  status: z.enum(snippetStatuses).default("draft"),
  visibility: z.enum(snippetVisibilities).default("public"),
  publishedAt: z.string().nullish(),
  tagIds: z.array(z.number()).default([]),
});

export const snippetStatusSchema = z.object({
  status: z.enum(snippetStatuses),
});

// 更新昵称（个人资料页）
export const updateNameSchema = z.object({
  name: z.string().min(1, "昵称不能为空").max(64, "昵称过长"),
});

// ─── 导出类型 ───
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type SnippetInput = z.infer<typeof snippetSchema>;
export type SnippetFormValues = z.input<typeof snippetSchema>;
export type SnippetStatusInput = z.infer<typeof snippetStatusSchema>;
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
