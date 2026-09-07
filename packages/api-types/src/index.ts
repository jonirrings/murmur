// packages/api-types/src/index.ts
export interface SnippetListItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  language: string | null;
  tags: { slug: string; name: string; color: string | null }[];
  publishedAt: string | null;
  createdAt: string;
}

export interface SnippetDetail extends SnippetListItem {
  contentMd: string; // Markdown 正文，前台直接渲染
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
