"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, type Paginated, type Snippet } from "@/lib/api";

const statusLabels: Record<Snippet["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

export default function SnippetsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "snippets", page],
    queryFn: () => apiFetch<Paginated<Snippet>>(`/api/admin/snippets?page=${page}&pageSize=10`),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/snippets/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "snippets"] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Snippet["status"] }) =>
      apiFetch(`/api/admin/snippets/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "snippets"] }),
  });

  function handleDelete(id: number) {
    if (!window.confirm("确定删除这条碎片？")) return;
    // 若当前页只剩这一条且不在第一页，删除后回退一页，避免停留在空页
    const shouldGoBack = (query.data?.items.length ?? 0) === 1 && page > 1;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (shouldGoBack) setPage((p) => Math.max(1, p - 1));
      },
    });
  }

  function handleStatus(id: number, status: Snippet["status"]) {
    statusMutation.mutate({ id, status });
  }

  if (query.isLoading) return <p className="text-muted-foreground">加载中...</p>;
  if (query.isError) return <p className="text-destructive">{query.error.message}</p>;

  const data = query.data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">碎片管理</h1>
        <Link href="/admin/snippets/new">
          <Button>新建碎片</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>标签</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data && data.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                暂无碎片
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link href={`/admin/snippets/${s.id}`} className="font-medium hover:underline">
                  {s.title}
                </Link>
                <div className="text-xs text-muted-foreground">{s.slug}</div>
              </TableCell>
              <TableCell>
                <Badge variant={s.status === "published" ? "default" : "secondary"}>
                  {statusLabels[s.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {s.tags.map((t) => (
                    <Badge key={t.id} variant="outline">
                      #{t.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(s.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {s.status !== "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatus(s.id, "published")}
                    >
                      发布
                    </Button>
                  )}
                  {s.status === "published" && (
                    <Button size="sm" variant="outline" onClick={() => handleStatus(s.id, "draft")}>
                      撤回
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleDelete(s.id)}>
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            第 {data.page} / {data.totalPages} 页 · 共 {data.total} 条
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("zh-CN");
}
