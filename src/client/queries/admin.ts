import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/client/lib/api";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "author" | "commenter";
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface UserList {
  items: UserInfo[];
  total: number;
  page: number;
  limit: number;
}

export function usePendingUsers() {
  return useQuery({
    queryKey: ["admin", "users", "pending"],
    queryFn: () => fetchApi<{ data: UserInfo[] }>("/admin/users/pending").then((r) => r.data),
  });
}

export function useAllUsers(params?: {
  page?: number;
  limit?: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  role?: "admin" | "author" | "commenter";
}) {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.approvalStatus) searchParams.set("approvalStatus", params.approvalStatus);
      if (params?.role) searchParams.set("role", params.role);
      return fetchApi<{ data: UserList }>(`/admin/users?${searchParams.toString()}`).then(
        (r) => r.data,
      );
    },
  });
}

export function useUpdateApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalStatus }: { id: string; approvalStatus: "approved" | "rejected" }) =>
      fetchApi<{ data: UserInfo }>(`/admin/users/${id}/approval`, {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus }),
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: "admin" | "author" | "commenter" }) =>
      fetchApi<{ data: UserInfo }>(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () =>
      fetchApi<{ data: Record<string, string> }>("/admin/settings").then((r) => r.data),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, string>) =>
      fetchApi<{ data: { ok: boolean } }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings }),
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });
}

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "author" | "commenter";
  approvalStatus: "pending" | "approved" | "rejected";
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
  passkeys: Array<{ id: string; name: string | null; createdAt: string | null }>;
  linkedAccounts: Array<{
    id: string;
    providerId: string;
    accountId: string;
    createdAt: string | null;
  }>;
}

export function useUserDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => fetchApi<{ data: UserDetail }>(`/admin/users/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useResetUserTotp(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi<{ data: { success: boolean } }>(`/admin/users/${id}/totp`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function useDeleteUserPasskey(userId: string) {
  const queryClient = useQueryClient();
  const deleteOne = useMutation({
    mutationFn: (passkeyId: string) =>
      fetchApi<{ data: { success: boolean } }>(`/admin/users/${userId}/passkeys/${passkeyId}`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
  });
  const deleteAll = useMutation({
    mutationFn: () =>
      fetchApi<{ data: { success: boolean } }>(`/admin/users/${userId}/passkeys`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
  });
  return {
    isPending: deleteOne.isPending || deleteAll.isPending,
    deleteOne,
    deleteAll,
  };
}

export function useBanUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      fetchApi<{ data: { success: boolean } }>(`/admin/users/${userId}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
  });
}

export function useUnbanUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi<{ data: { success: boolean } }>(`/admin/users/${userId}/unban`, {
        method: "POST",
      }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
  });
}
