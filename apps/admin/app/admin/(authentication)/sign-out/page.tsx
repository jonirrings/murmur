"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function SignOutPage() {
  const router = useRouter();

  const { mutate, error } = useMutation({
    mutationFn: () => apiFetch("/api/auth/sign-out", { method: "POST", body: "{}" }),
    onSuccess: () => {
      router.replace("/admin/sign-in");
      router.refresh();
    },
  });

  useEffect(() => {
    mutate();
  }, [mutate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      {error ? (
        <p className="text-destructive">{error.message}</p>
      ) : (
        <p className="text-muted-foreground">正在登出...</p>
      )}
    </main>
  );
}
