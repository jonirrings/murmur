"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { signUpSchema } from "@murmur/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, errorMessages } from "@/lib/api";

export default function SignUpPage() {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (values: { name: string; email: string; password: string }) =>
      apiFetch("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      router.push("/admin");
      router.refresh();
    },
  });

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>注册</CardTitle>
          <CardDescription>创建管理员账号</CardDescription>
        </CardHeader>
        <CardContent>
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
                    autoComplete="name"
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

            <form.Field name="email">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={field.name}>邮箱</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
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

            <form.Field name="password">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={field.name}>密码</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
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

            {mutation.isError && (
              <p className="text-sm text-destructive">{mutation.error.message}</p>
            )}

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "注册中..." : "注册"}
                </Button>
              )}
            </form.Subscribe>

            <p className="text-center text-sm text-muted-foreground">
              已有账号？{" "}
              <Link href="/admin/sign-in" className="underline">
                登录
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
