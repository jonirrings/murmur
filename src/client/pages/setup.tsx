import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetupStatus, useCreateAdmin } from "@/client/queries/setup";
import { useState, type FormEvent } from "react";

const setupSchema = z.object({
  name: z.string().min(1, "请输入姓名").max(100),
  email: z.email("请输入有效的邮箱地址"),
});

type SetupForm = z.infer<typeof setupSchema>;

export function SetupPage() {
  const { data: status } = useSetupStatus();
  const createAdmin = useCreateAdmin();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
  });

  if (status?.setupComplete) {
    window.location.href = "/login";
    return null;
  }

  const onSubmit = async (data: SetupForm) => {
    setError(null);
    try {
      await createAdmin.mutateAsync(data);
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "初始化失败，请重试");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2">Murmur 初始化</h1>
        <p className="text-gray-500 text-center mb-8">创建管理员账号以开始使用</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSubmit(onSubmit)(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              姓名
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              placeholder="你的名字"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              placeholder="admin@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? "创建中..." : "创建管理员"}
          </button>
        </form>
      </div>
    </div>
  );
}
