"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SnippetForm } from "@/components/snippet-form";
import { apiFetch, type Tag } from "@/lib/api";

export default function NewSnippetPage() {
  const tagsQuery = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: () => apiFetch<{ items: Tag[] }>("/api/admin/tags"),
  });

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/snippets" className="text-sm text-muted-foreground hover:underline">
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">新建碎片</h1>
      </div>
      {tagsQuery.isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <SnippetForm tags={tagsQuery.data?.items ?? []} />
      )}
    </div>
  );
}
