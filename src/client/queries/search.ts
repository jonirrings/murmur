import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/client/lib/api";
import type { NoteCategory } from "@/shared/types";

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  slug: string | null;
  category: NoteCategory;
  wordCount: number;
  publishedAt: string | null;
  createdAt: string;
  authorName: string | null;
}

interface SearchResults {
  items: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

interface SearchParams {
  q: string;
  category?: NoteCategory;
  tag?: string;
  page?: number;
  limit?: number;
}

export function useSearch(params: SearchParams) {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  if (params.category) searchParams.set("category", params.category);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["search", params],
    queryFn: () =>
      fetchApi(`/search?${searchParams.toString()}`) as Promise<{ data: SearchResults }>,
    enabled: params.q.trim().length > 0,
  });
}
