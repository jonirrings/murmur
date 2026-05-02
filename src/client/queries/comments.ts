import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/client/lib/api";

export interface Comment {
  id: string;
  noteId: string;
  authorId: string;
  content: string;
  authorApproved: number;
  adminHidden: number;
  createdAt: string;
  authorName: string | null;
  authorImage: string | null;
  authorApprovalStatus?: string;
}

interface CommentList {
  items: Comment[];
  total: number;
  page: number;
  limit: number;
}

export function useComments(noteId: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: ["comments", noteId, { page, limit }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      return fetchApi<{ data: CommentList }>(`/notes/${noteId}/comments?${params.toString()}`).then(
        (r) => r.data,
      );
    },
    enabled: !!noteId,
  });
}

export function useCreateComment(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string }) =>
      fetchApi<{ data: Comment }>(`/notes/${noteId}/comments`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", noteId] });
    },
  });
}

export function useReviewComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; authorApproved?: boolean; adminHidden?: boolean }) => {
      const { id, ...body } = input;
      return fetchApi<{ data: Comment }>(`/comments/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }).then((r) => r.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: { ok: boolean } }>(`/comments/${id}`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
  });
}

export function usePendingComments() {
  return useQuery({
    queryKey: ["admin", "comments", "pending"],
    queryFn: () => fetchApi<{ data: Comment[] }>("/admin/comments/pending").then((r) => r.data),
  });
}

export function useAdminComments(params?: {
  page?: number;
  limit?: number;
  noteId?: string;
  authorApproved?: number;
  adminHidden?: number;
}) {
  return useQuery({
    queryKey: ["admin", "comments", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.noteId) searchParams.set("noteId", params.noteId);
      if (params?.authorApproved !== undefined)
        searchParams.set("authorApproved", String(params.authorApproved));
      if (params?.adminHidden !== undefined)
        searchParams.set("adminHidden", String(params.adminHidden));
      return fetchApi<{ data: CommentList }>(`/admin/comments?${searchParams.toString()}`).then(
        (r) => r.data,
      );
    },
  });
}
