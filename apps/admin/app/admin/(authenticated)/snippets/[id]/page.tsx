"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SnippetForm } from "@/components/snippet-form";
import { apiFetch, type Snippet, type Tag } from "@/lib/api";

export default function EditSnippetPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const snippetQuery = useQuery({
    queryKey: ["admin", "snippets", id],
    queryFn: () => apiFetch<Snippet>(`/api/admin/snippets/${id}`),
  });

  const tagsQuery = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: () => apiFetch<{ items: Tag[] }>("/api/admin/tags"),
  });

  if (snippetQuery.isLoading) return <p className="text-muted-foreground">加载中...</p>;
  if (snippetQuery.isError) return <p className="text-destructive">{snippetQuery.error.message}</p>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/snippets" className="text-sm text-muted-foreground hover:underline">
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">编辑碎片</h1>
      </div>
      {snippetQuery.data && (
        <SnippetForm snippet={snippetQuery.data} tags={tagsQuery.data?.items ?? []} />
      )}
    </div>
  );
}
