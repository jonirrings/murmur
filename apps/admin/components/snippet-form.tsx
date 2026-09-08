"use client";

import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { snippetSchema, type SnippetFormValues } from "@murmur/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { apiFetch, errorMessages, type Snippet, type Tag } from "@/lib/api";

type Props = {
  snippet?: Snippet;
  tags: Tag[];
};

export function SnippetForm({ snippet, tags }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: SnippetFormValues) =>
      snippet
        ? apiFetch(`/api/admin/snippets/${snippet.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch("/api/admin/snippets", {
            method: "POST",
            body: JSON.stringify(payload),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "snippets"] });
      router.push("/admin/snippets");
      router.refresh();
    },
  });

  const form = useForm({
    defaultValues: {
      slug: snippet?.slug ?? "",
      title: snippet?.title ?? "",
      contentMd: snippet?.contentMd ?? "",
      excerpt: snippet?.excerpt ?? null,
      language: snippet?.language ?? "",
      coverImage: snippet?.coverImage ?? null,
      status: snippet?.status ?? "draft",
      visibility: snippet?.visibility ?? "public",
      publishedAt: snippet?.publishedAt ?? null,
      tagIds: snippet?.tags.map((t) => t.id) ?? [],
    } as SnippetFormValues,
    validators: { onSubmit: snippetSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        ...value,
        slug: value.slug?.trim() || undefined,
        language: value.language?.trim() || null,
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
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="title">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>标题</Label>
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
              <Label htmlFor={field.name}>Slug（留空自动生成）</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value ?? ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="my-til-note"
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="contentMd">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>正文（Markdown）</Label>
            <Textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              rows={14}
              className="font-mono text-sm"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {errorMessages(field.state.meta.errors).join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <form.Field name="language">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>语言 / 技术</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value ?? ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="rust"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="status">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>状态</Label>
              <NativeSelect
                id={field.name}
                value={field.state.value ?? "draft"}
                onChange={(e) => field.handleChange(e.target.value as SnippetFormValues["status"])}
              >
                <NativeSelectOption value="draft">草稿</NativeSelectOption>
                <NativeSelectOption value="published">已发布</NativeSelectOption>
                <NativeSelectOption value="archived">已归档</NativeSelectOption>
              </NativeSelect>
            </div>
          )}
        </form.Field>

        <form.Field name="visibility">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>可见性</Label>
              <NativeSelect
                id={field.name}
                value={field.state.value ?? "public"}
                onChange={(e) =>
                  field.handleChange(e.target.value as SnippetFormValues["visibility"])
                }
              >
                <NativeSelectOption value="public">公开</NativeSelectOption>
                <NativeSelectOption value="unlisted">不列出</NativeSelectOption>
                <NativeSelectOption value="private">私密</NativeSelectOption>
              </NativeSelect>
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="tagIds">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label>标签</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const value = field.state.value ?? [];
                const selected = value.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      field.handleChange(
                        selected ? value.filter((x) => x !== t.id) : [...value, t.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    #{t.name}
                  </button>
                );
              })}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无标签，可先到「标签管理」创建</p>
              )}
            </div>
          </div>
        )}
      </form.Field>

      {mutation.isError && <p className="text-sm text-destructive">{mutation.error.message}</p>}

      <div className="flex gap-2">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          )}
        </form.Subscribe>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/snippets")}>
          取消
        </Button>
      </div>
    </form>
  );
}
