import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/client/lib/api";

interface SetupStatus {
  setupComplete: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "author" | "commenter";
  approvalStatus: "pending" | "approved" | "rejected";
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ["setup", "status"],
    queryFn: () =>
      fetchApi<{ data: SetupStatus }>("/setup/status").then((r) => r.data),
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string }) =>
      fetchApi<{ data: AdminUser }>("/setup/admin", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup", "status"] });
    },
  });
}
