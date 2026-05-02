import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient, useSession } from "@/client/lib/auth-client";
import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { KeyRound, ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  email: z.email(),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation("auth");
  const { data: session } = useSession();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [securityKeyLoading, setSecurityKeyLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const handler = () => setTwoFactorRequired(true);
    window.addEventListener("auth:two-factor-required", handler);
    return () => window.removeEventListener("auth:two-factor-required", handler);
  }, []);

  if (session?.user && !twoFactorRequired) {
    window.location.href = "/admin";
    return null;
  }

  const onSendMagicLink = async (data: LoginForm) => {
    setError(null);
    try {
      await authClient.signIn.magicLink({ email: data.email });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("auth:login.failed"));
    }
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    try {
      const result = await authClient.signIn.passkey();
      if (result.data) {
        window.location.href = "/admin";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("auth:login.passkeyFailed"));
    }
  };

  const handleGitHubSignIn = async () => {
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: window.location.origin + "/admin",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("auth:login.githubFailed"));
    }
  };

  const handleVerify2FA = async () => {
    setOtpError(null);
    setOtpVerifying(true);
    try {
      await authClient.twoFactor.verifyTotp({ code: otpCode });
      window.location.href = "/admin";
    } catch {
      setOtpError(t("login.invalidCode"));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSecurityKey2FA = async () => {
    setOtpError(null);
    setSecurityKeyLoading(true);
    try {
      await authClient.signIn.passkey();
      window.location.href = "/admin";
    } catch {
      setOtpError(t("login.securityKeyFailed"));
    } finally {
      setSecurityKeyLoading(false);
    }
  };

  if (twoFactorRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-2">{t("login.twoFactorTitle")}</h1>
          <p className="text-gray-500 text-center mb-8">{t("login.twoFactorSubtitle")}</p>

          {otpError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
              {otpError}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder={t("login.otpPlaceholder")}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 text-center text-lg tracking-widest"
              maxLength={6}
              autoFocus
            />
            <button
              onClick={handleVerify2FA}
              disabled={otpVerifying || otpCode.length < 6}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {otpVerifying ? t("login.verifying") : t("login.verifyButton")}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  {t("login.orDivider")}
                </span>
              </div>
            </div>

            <button
              onClick={handleSecurityKey2FA}
              disabled={securityKeyLoading}
              className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              {securityKeyLoading ? t("login.verifying") : t("login.useSecurityKey")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2">{t("login.title")}</h1>
        <p className="text-gray-500 text-center mb-8">{t("login.subtitle")}</p>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
              {t("login.sentMessage")}
            </div>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              {t("login.resend")}
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
                {error}
              </div>
            )}

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void handleSubmit(onSendMagicLink)();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="email">
                  {t("login.emailLabel")}
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="you@example.com"
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
                {isSubmitting ? t("login.sending") : t("login.sendButton")}
              </button>
            </form>

            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                    {t("login.orDivider")}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePasskeySignIn}
                className="mt-4 w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-5 h-5" />
                {t("login.passkeyButton")}
              </button>

              <button
                onClick={handleGitHubSignIn}
                className="mt-2 w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {t("login.githubButton")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
