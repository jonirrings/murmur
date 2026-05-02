import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { authClient, useSession } from "@/client/lib/auth-client";
import { KeyRound, Trash2, Pencil, Check, X } from "lucide-react";

export function AdminSecurity() {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { data: sessionData } = useSession();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<
    Array<{ id: string; name?: string | null; createdAt?: Date | null }>
  >([]);
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState("");
  const [linkedAccounts, setLinkedAccounts] = useState<
    Array<{ id: string; providerId: string; accountId: string; createdAt?: string | null }>
  >([]);

  useEffect(() => {
    void loadPasskeys();
    void loadLinkedAccounts();
  }, []);

  useEffect(() => {
    if (sessionData?.user) {
      setTotpEnabled(
        (sessionData.user as unknown as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false,
      );
    }
  }, [sessionData]);

  const loadPasskeys = async () => {
    try {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.data) {
        setPasskeys(
          result.data as Array<{ id: string; name?: string | null; createdAt?: Date | null }>,
        );
      }
    } catch {
      // Not critical
    }
  };

  const loadLinkedAccounts = async () => {
    try {
      const res = await fetch("/api/me/linked-accounts");
      if (res.ok) {
        const body = (await res.json()) as {
          data: Array<{
            id: string;
            providerId: string;
            accountId: string;
            createdAt?: string | null;
          }>;
        };
        setLinkedAccounts(body.data);
      }
    } catch {
      // Not critical
    }
  };

  const handleEnableTotp = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ issuer: "Murmur" });
      if (result.data) {
        setTotpUri(result.data.totpURI ?? null);
      }
    } catch {
      setError(t("security.enableTotpFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async () => {
    setLoading(true);
    setError(null);
    try {
      await authClient.twoFactor.verifyTotp({ code: verifyCode });
      setTotpEnabled(true);
      setTotpUri(null);
      setVerifyCode("");
      const backupResult = await authClient.twoFactor.generateBackupCodes({});
      if (backupResult.data) {
        setBackupCodes(backupResult.data.backupCodes as string[]);
        setShowBackupCodes(true);
      }
    } catch {
      setError(t("security.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    setLoading(true);
    setError(null);
    try {
      await authClient.twoFactor.disable({ password: "" });
      setTotpEnabled(false);
      setBackupCodes(null);
      setShowBackupCodes(false);
    } catch {
      setError(t("security.disableTotpFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPasskey = async () => {
    setPasskeyLoading(true);
    try {
      await authClient.passkey.addPasskey({ name: passkeyName || undefined });
      setPasskeyName("");
      await loadPasskeys();
    } catch {
      // User may cancel browser dialog
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!window.confirm(t("security.deletePasskeyConfirm"))) return;
    try {
      await authClient.passkey.deletePasskey({ id });
      await loadPasskeys();
    } catch {
      setError(t("security.deletePasskeyFailed"));
    }
  };

  const handleRenamePasskey = async (id: string, name: string) => {
    try {
      await authClient.passkey.updatePasskey({ id, name });
      setEditingPasskeyId(null);
      await loadPasskeys();
    } catch {
      setError(t("security.renamePasskeyFailed"));
    }
  };

  const handleUnlinkAccount = async (providerId: string) => {
    if (!window.confirm(t("security.unlinkConfirm"))) return;
    try {
      const res = await fetch(`/api/me/linked-accounts/${providerId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? t("security.cannotUnlink"));
        return;
      }
      await loadLinkedAccounts();
    } catch {
      setError(t("security.cannotUnlink"));
    }
  };

  const githubAccount = linkedAccounts.find((a) => a.providerId === "github");

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        {t("security.title")}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">
            ✕
          </button>
        </div>
      )}

      {/* TOTP Section */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          {t("security.totpSection")}
        </h3>

        {totpEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-green-600 dark:text-green-400">
              {t("security.totpEnabled")}
            </p>
            <button
              onClick={handleDisableTotp}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t("security.disableTotp")}
            </button>
          </div>
        ) : totpUri ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("security.scanQrCode")}</p>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-mono break-all text-gray-500 dark:text-gray-400">
                {totpUri}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder={t("security.enterCode")}
                className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 tracking-widest text-center"
                maxLength={6}
              />
              <button
                onClick={handleVerifyTotp}
                disabled={loading || verifyCode.length < 6}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t("security.verifyCode")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleEnableTotp}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("security.enableTotp")}
          </button>
        )}

        {showBackupCodes && backupCodes && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
              {t("security.backupCodesTitle")}
            </h4>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
              {t("security.backupCodesDesc")}
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-gray-700 dark:text-gray-300">
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowBackupCodes(false)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              {t("security.hideBackupCodes")}
            </button>
          </div>
        )}
      </div>

      {/* Passkeys Section */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          {t("security.passkeySection")}
        </h3>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t("security.securityKeyAs2FA")}
        </p>

        <div className="space-y-3 mb-4">
          {passkeys.length > 0 ? (
            passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <KeyRound className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {editingPasskeyId === pk.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editingPasskeyName}
                        onChange={(e) => setEditingPasskeyName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            void handleRenamePasskey(pk.id, editingPasskeyName);
                          if (e.key === "Escape") setEditingPasskeyId(null);
                        }}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenamePasskey(pk.id, editingPasskeyName)}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingPasskeyId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {pk.name || t("security.unnamedPasskey")}
                      </p>
                      {pk.createdAt && (
                        <p className="text-xs text-gray-500">
                          {pk.createdAt instanceof Date
                            ? pk.createdAt.toLocaleDateString()
                            : String(pk.createdAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {editingPasskeyId !== pk.id && (
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => {
                        setEditingPasskeyId(pk.id);
                        setEditingPasskeyName(pk.name || "");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={t("security.renamePasskey")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePasskey(pk.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={t("security.deletePasskey")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">{t("security.noPasskeys")}</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            placeholder={t("security.passkeyNamePlaceholder")}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            onClick={handleAddPasskey}
            disabled={passkeyLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {passkeyLoading ? tc("actions.saving") : t("security.addPasskey")}
          </button>
        </div>
      </div>

      {/* Linked Accounts Section */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          {t("security.linkedAccounts")}
        </h3>

        <div className="space-y-3">
          {/* GitHub */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-gray-700 dark:text-gray-300"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-white">GitHub</span>
            </div>
            {githubAccount ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 dark:text-green-400">
                  {t("security.githubLinked")}
                </span>
                <button
                  onClick={() => handleUnlinkAccount("github")}
                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
                >
                  {t("security.unlinkGitHub")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  void authClient.signIn.social({
                    provider: "github",
                    callbackURL: window.location.origin + "/admin/security",
                  });
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t("security.linkGitHub")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
