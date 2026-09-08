"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateNameSchema, type UpdateNameInput } from "@murmur/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, errorMessages, type SessionInfo } from "@/lib/api";

function NameForm({ initialName, onSaved }: { initialName: string; onSaved: () => void }) {
  const mutation = useMutation({
    mutationFn: (values: UpdateNameInput) =>
      apiFetch("/api/auth/update-user", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: onSaved,
  });

  const form = useForm({
    defaultValues: { name: initialName } as UpdateNameInput,
    validators: { onSubmit: updateNameSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>昵称</Label>
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

      {mutation.isError && <p className="text-sm text-destructive">{mutation.error.message}</p>}
      {mutation.isSuccess && <p className="text-sm text-green-600">已更新</p>}

      <div>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionInfo | null>("/api/auth/get-session"),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch("/api/auth/delete-user", { method: "POST", body: "{}" }),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/admin/sign-in");
      router.refresh();
    },
  });

  const user = sessionQuery.data?.user;

  if (sessionQuery.isLoading) return <p className="text-muted-foreground">加载中...</p>;
  if (sessionQuery.isError || !user) {
    return <p className="text-destructive">无法加载用户信息</p>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">个人资料</h1>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>你的登录信息</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">昵称：</span>
            {user.name}
          </div>
          <div>
            <span className="text-muted-foreground">邮箱：</span>
            {user.email}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>更新昵称</CardTitle>
          <CardDescription>修改显示名称</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm
            key={user.name}
            initialName={user.name}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["session"] })}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">注销账号</CardTitle>
          <CardDescription>永久删除账号及所有数据，不可恢复</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {deleteMutation.isError && (
            <p className="text-sm text-destructive">{deleteMutation.error.message}</p>
          )}
          {!confirming ? (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              注销账号
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive">确认永久注销？此操作不可恢复。</p>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "注销中..." : "确认注销"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={deleteMutation.isPending}
              >
                取消
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
