import { useParams, useNavigate } from "@tanstack/react-router";
import {
  useUserDetail,
  useResetUserTotp,
  useDeleteUserPasskey,
  useBanUser,
  useUnbanUser,
} from "@/client/queries/admin";
import { useTranslation } from "react-i18next";
import { ArrowLeft, KeyRound, Shield, Trash2, Ban, ShieldCheck } from "lucide-react";

export function AdminUserDetail() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const navigate = useNavigate();
  const { t } = useTranslation("admin");
  const { data: user, isLoading, refetch } = useUserDetail(userId);
  const resetTotp = useResetUserTotp(userId);
  const deletePasskey = useDeleteUserPasskey(userId);
  const banUser = useBanUser(userId);
  const unbanUser = useUnbanUser(userId);

  if (isLoading) {
    return <p className="text-gray-400">{t("userDetail.loading")}</p>;
  }

  if (!user) {
    return <p className="text-gray-400">{t("userDetail.notFound")}</p>;
  }

  const handleResetTotp = async () => {
    if (!window.confirm(t("userDetail.resetTotpConfirm"))) return;
    await resetTotp.mutateAsync();
    void refetch();
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    if (!window.confirm(t("userDetail.deletePasskeyConfirm"))) return;
    await deletePasskey.deleteOne.mutateAsync(passkeyId);
    void refetch();
  };

  const handleDeleteAllPasskeys = async () => {
    if (!window.confirm(t("userDetail.deleteAllPasskeysConfirm"))) return;
    await deletePasskey.deleteAll.mutateAsync();
    void refetch();
  };

  const handleBan = async () => {
    const reason = window.prompt(t("userDetail.banReasonPrompt"));
    if (reason === null) return;
    await banUser.mutateAsync(reason ?? undefined);
    void refetch();
  };

  const handleUnban = async () => {
    if (!window.confirm(t("userDetail.unbanConfirm"))) return;
    await unbanUser.mutateAsync();
    void refetch();
  };

  const providerLabel = (providerId: string) => {
    switch (providerId) {
      case "github":
        return "GitHub";
      case "magic-link":
        return "Magic Link";
      default:
        return providerId;
    }
  };

  return (
    <div>
      <button
        onClick={() => void navigate({ to: "/admin/users" })}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("userDetail.back")}
      </button>

      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        {t("userDetail.title")}
      </h2>

      {/* User Info */}
      <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t("userDetail.nameLabel")}</span>
            <p className="font-medium text-gray-900 dark:text-white">{user.name ?? "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">{t("userDetail.emailLabel")}</span>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
          </div>
          <div>
            <span className="text-gray-500">{t("userDetail.roleLabel")}</span>
            <p className="font-medium text-gray-900 dark:text-white">{user.role}</p>
          </div>
          <div>
            <span className="text-gray-500">{t("userDetail.statusLabel")}</span>
            <p className="font-medium text-gray-900 dark:text-white">{user.approvalStatus}</p>
          </div>
          <div>
            <span className="text-gray-500">{t("userDetail.createdAtLabel")}</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-end">
            {user.banned ? (
              <button
                onClick={handleUnban}
                disabled={unbanUser.isPending}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                {unbanUser.isPending ? t("userDetail.processing") : t("userDetail.unbanUser")}
              </button>
            ) : (
              <button
                onClick={handleBan}
                disabled={banUser.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Ban className="h-4 w-4" />
                {banUser.isPending ? t("userDetail.processing") : t("userDetail.banUser")}
              </button>
            )}
          </div>
        </div>
        {user.banned && user.banReason && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {t("userDetail.banReason")}: {user.banReason}
          </p>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t("userDetail.twoFactor")}
        </h3>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t("userDetail.totpSection")}
              </p>
              <p className="text-sm text-gray-500">
                {user.twoFactorEnabled
                  ? t("userDetail.totpEnabled")
                  : t("userDetail.totpNotEnabled")}
              </p>
            </div>
            {user.twoFactorEnabled && (
              <button
                onClick={handleResetTotp}
                disabled={resetTotp.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resetTotp.isPending ? t("userDetail.resetting") : t("userDetail.resetTotp")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Passkeys */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t("userDetail.passkeys")}
        </h3>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {user.passkeys.length > 0 ? (
            <div className="space-y-3">
              {user.passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between p-2 rounded border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pk.name || t("userDetail.unnamedPasskey")}
                    </p>
                    {pk.createdAt && (
                      <p className="text-xs text-gray-500">
                        {new Date(pk.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePasskey(pk.id)}
                    disabled={deletePasskey.isPending}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={t("userDetail.deletePasskey")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {user.passkeys.length > 1 && (
                <button
                  onClick={handleDeleteAllPasskeys}
                  disabled={deletePasskey.isPending}
                  className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {t("userDetail.deleteAllPasskeys")}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("userDetail.noPasskeys")}</p>
          )}
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          {t("userDetail.linkedAccounts")}
        </h3>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {user.linkedAccounts.length > 0 ? (
            <div className="space-y-2">
              {user.linkedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-2 rounded border border-gray-100 dark:border-gray-700"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {providerLabel(acc.providerId)}
                  </p>
                  {acc.createdAt && (
                    <p className="text-xs text-gray-500">
                      {new Date(acc.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("userDetail.noLinkedAccounts")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
