"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch, type SessionInfo } from "@/lib/api";

const navItems = [
  { href: "/admin", label: "概览" },
  { href: "/admin/snippets", label: "碎片管理" },
  { href: "/admin/tags", label: "标签管理" },
  { href: "/admin/profile", label: "个人资料" },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionInfo | null>("/api/auth/get-session"),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (sessionQuery.data === null) {
      router.replace("/admin/sign-in");
    }
  }, [sessionQuery.data, router]);

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (sessionQuery.data == null) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-base font-semibold">
              碎碎念
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href="/admin/sign-out">
            <Button variant="outline" size="sm">
              登出
            </Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">{children}</main>
    </div>
  );
}
