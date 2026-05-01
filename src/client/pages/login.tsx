import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient, useSession } from "@/client/lib/auth-client";
import { useState, type FormEvent } from "react";

const loginSchema = z.object({
  email: z.email("请输入有效的邮箱地址"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { data: session } = useSession();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  if (session) {
    window.location.href = "/admin";
    return null;
  }

  const onSendMagicLink = async (data: LoginForm) => {
    setError(null);
    try {
      await authClient.signIn.magicLink({ email: data.email });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2">登录 Murmur</h1>
        <p className="text-gray-500 text-center mb-8">
          输入邮箱，通过 Magic Link 登录
        </p>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
              登录链接已发送到你的邮箱，请查收。
            </div>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              重新发送
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
                {error}
              </div>
            )}

            <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSubmit(onSendMagicLink)(); }} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  htmlFor="email"
                >
                  邮箱
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="you@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {isSubmitting ? "发送中..." : "发送登录链接"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
