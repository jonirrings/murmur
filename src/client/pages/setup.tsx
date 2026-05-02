import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetupStatus, useCreateAdmin } from "@/client/queries/setup";
import { authClient } from "@/client/lib/auth-client";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { KeyRound } from "lucide-react";

const setupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
});

type SetupForm = z.infer<typeof setupSchema>;

export function SetupPage() {
  const { t } = useTranslation("auth");
  const { data } = useSetupStatus();
  const createAdmin = useCreateAdmin();
  const [error, setError] = useState<string | null>(null);
  const [adminCreated, setAdminCreated] = useState(false);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
  });

  if (data?.setupComplete && !adminCreated) {
    window.location.href = "/login";
    return null;
  }

  const onSubmit = async (data: SetupForm) => {
    setError(null);
    try {
      await createAdmin.mutateAsync(data);
      setAdminCreated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("auth:setup.failed"));
    }
  };

  const handleAddPasskey = async () => {
    setPasskeyRegistering(true);
    try {
      await authClient.passkey.addPasskey({ name: "Admin Passkey" });
    } catch {
      // User may cancel the browser dialog
    } finally {
      setPasskeyRegistering(false);
    }
  };

  const handleGoToLogin = () => {
    window.location.href = "/login";
  };

  if (adminCreated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-2">{t("setup.successTitle")}</h1>
          <p className="text-gray-500 text-center mb-8">{t("setup.successSubtitle")}</p>

          <div className="space-y-4">
            <button
              onClick={handleAddPasskey}
              disabled={passkeyRegistering}
              className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-5 h-5" />
              {passkeyRegistering ? t("setup.registeringPasskey") : t("setup.addPasskey")}
            </button>
            <p className="text-xs text-gray-500 text-center">{t("setup.passkeyOptional")}</p>

            <button
              onClick={handleGoToLogin}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {t("setup.goToLogin")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2">{t("setup.title")}</h1>
        <p className="text-gray-500 text-center mb-8">{t("setup.subtitle")}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void handleSubmit(onSubmit)();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              {t("setup.nameLabel")}
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              placeholder={t("setup.namePlaceholder")}
              {...register("name")}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              {t("setup.emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              placeholder="admin@example.com"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? t("setup.creating") : t("setup.createButton")}
          </button>
        </form>
      </div>
    </div>
  );
}
