import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/client/lib/api";

export interface MeInfo {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "author" | "commenter";
  approvalStatus: "pending" | "approved" | "rejected";
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchApi<{ data: MeInfo }>("/me").then((r) => r.data),
    staleTime: 60_000,
  });
}

export interface AdminStats {
  publishedNotes: number;
  pendingComments: number;
  pendingUsers: number;
  totalUsers: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchApi<{ data: AdminStats }>("/me/admin/stats").then((r) => r.data),
  });
}
