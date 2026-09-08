"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tagSchema, type TagInput } from "@murmur/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, errorMessages, type Tag } from "@/lib/api";

type EditingTag = {
  id: number | null;
  slug: string;
  name: string;
  description: string;
  color: string;
};

const emptyTag: EditingTag = { id: null, slug: "", name: "", description: "", color: "" };

type TagFormProps = {
  initial: EditingTag;
  isPending: boolean;
  errorMessage: string | null;
  onSubmit: (payload: TagInput) => Promise<unknown>;
  onCancel: () => void;
};

function TagForm({ initial, isPending, errorMessage, onSubmit, onCancel }: TagFormProps) {
  const form = useForm({
    defaultValues: {
      slug: initial.slug,
      name: initial.name,
      description: initial.description,
      color: initial.color,
    } as TagInput,
    validators: { onSubmit: tagSchema },
    onSubmit: async ({ value }) => {
      await onSubmit({
        slug: value.slug,
        name: value.name,
        description: value.description?.trim() || null,
        color: value.color?.trim() || null,
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 className="mb-4 font-medium">{initial.id == null ? "新建标签" : "编辑标签"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>名称</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {errorMessages(field.state.meta.errors).join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="slug">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Slug</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="rust"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {errorMessages(field.state.meta.errors).join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>描述</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value ?? ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="color">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>颜色（Tailwind 类名）</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value ?? ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="bg-blue-500"
              />
            </div>
          )}
        </form.Field>
      </div>

      {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}

      <div className="mt-4 flex gap-2">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting || isPending}>
              {isSubmitting || isPending ? "保存中..." : "保存"}
            </Button>
          )}
        </form.Subscribe>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          取消
        </Button>
      </div>
    </form>
  );
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingTag | null>(null);

  const query = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: () => apiFetch<{ items: Tag[] }>("/api/admin/tags"),
  });

  const saveMutation = useMutation({
    mutationFn: (input: { id: number | null; payload: TagInput }) =>
      input.id == null
        ? apiFetch("/api/admin/tags", { method: "POST", body: JSON.stringify(input.payload) })
        : apiFetch(`/api/admin/tags/${input.id}`, {
            method: "PUT",
            body: JSON.stringify(input.payload),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tags"] }),
  });

  function startEdit(tag: Tag) {
    setEditing({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      description: tag.description ?? "",
      color: tag.color ?? "",
    });
  }

  function handleDelete(tag: Tag) {
    if (!window.confirm(`确定删除标签「${tag.name}」？`)) return;
    deleteMutation.mutate(tag.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">标签管理</h1>
        <Button onClick={() => setEditing(emptyTag)}>新建标签</Button>
      </div>

      {editing && (
        <TagForm
          key={editing.id ?? "new"}
          initial={editing}
          isPending={saveMutation.isPending}
          errorMessage={saveMutation.isError ? saveMutation.error.message : null}
          onSubmit={(payload) => saveMutation.mutateAsync({ id: editing.id, payload })}
          onCancel={() => setEditing(null)}
        />
      )}

      {query.isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : query.isError ? (
        <p className="text-destructive">{query.error.message}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>碎片数</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  暂无标签
                </TableCell>
              </TableRow>
            )}
            {query.data?.items.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{t.name}</Badge>
                    {t.description && (
                      <span className="text-sm text-muted-foreground">{t.description}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.slug}</TableCell>
                <TableCell>{t.snippetCount ?? 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(t)}
                      disabled={deleteMutation.isPending}
                    >
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
