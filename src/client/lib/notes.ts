import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/client/lib/api";
import type { NoteCategory } from "@/shared/types";

interface Note {
  id: string;
  authorId: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string | null;
  category: NoteCategory;
  status: "draft" | "published";
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  tags?: { id: string; name: string; slug: string }[];
  author?: { id: string; name: string | null; image: string | null };
}

interface NoteList {
  items: Note[];
  total: number;
  page: number;
  limit: number;
}

interface ListNotesParams {
  page?: number;
  limit?: number;
  status?: "draft" | "published";
  category?: NoteCategory;
  tag?: string;
}

export function useNotes(params?: ListNotesParams) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.tag) searchParams.set("tag", params.tag);

  return useQuery({
    queryKey: ["notes", params],
    queryFn: () =>
      fetchApi<{ data: NoteList }>(`/notes?${searchParams.toString()}`).then((r) => r.data),
  });
}

export function useMyNotes(params?: ListNotesParams) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.category) searchParams.set("category", params.category);

  return useQuery({
    queryKey: ["notes", "my", params],
    queryFn: () =>
      fetchApi<{ data: NoteList }>(`/notes/my?${searchParams.toString()}`).then((r) => r.data),
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: ["notes", id],
    queryFn: () => fetchApi<{ data: Note }>(`/notes/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useNoteBySlug(slug: string) {
  return useQuery({
    queryKey: ["notes", "slug", slug],
    queryFn: () => fetchApi<{ data: Note }>(`/notes/slug/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      content: string;
      category?: NoteCategory;
      tagIds?: string[];
    }) =>
      fetchApi<{ data: Note }>("/notes", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      content?: string;
      category?: NoteCategory;
      excerpt?: string;
      tagIds?: string[];
    }) =>
      fetchApi<{ data: Note }>(`/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["notes", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function usePublishNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, slug }: { id: string; slug?: string }) =>
      fetchApi<{ data: Note }>(`/notes/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ slug }),
      }).then((r) => r.data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["notes", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useUnpublishNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: Note }>(`/notes/${id}/unpublish`, {
        method: "POST",
      }).then((r) => r.data),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["notes", id] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: { ok: boolean } }>(`/notes/${id}`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
