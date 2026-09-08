"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { signInSchema } from "@murmur/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, errorMessages } from "@/lib/api";

export default function SignInPage() {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (values: { email: string; password: string }) =>
      apiFetch("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      router.push("/admin");
      router.refresh();
    },
  });

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>Murmur 管理后台</CardDescription>
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
                    autoComplete="current-password"
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
                  {isSubmitting ? "登录中..." : "登录"}
                </Button>
              )}
            </form.Subscribe>

            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link href="/admin/sign-up" className="underline">
                注册
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
