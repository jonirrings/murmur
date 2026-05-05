import { useTranslation } from "react-i18next";

export function PrivacyPage() {
  const { t } = useTranslation("common");
  const lastUpdated = "2026-05-05";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <h1>{t("privacy.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("privacy.lastUpdated", { date: lastUpdated })}
        </p>

        <p>{t("privacy.intro")}</p>

        <h2>{t("privacy.infoCollect")}</h2>
        <p>{t("privacy.infoCollectContent")}</p>

        <h2>{t("privacy.howWeUse")}</h2>
        <p>{t("privacy.howWeUseContent")}</p>

        <h2>{t("privacy.cookies")}</h2>
        <p>{t("privacy.cookiesContent")}</p>

        <h2>{t("privacy.dataSharing")}</h2>
        <p>{t("privacy.dataSharingContent")}</p>

        <h2>{t("privacy.dataRetention")}</h2>
        <p>{t("privacy.dataRetentionContent")}</p>

        <h2>{t("privacy.yourRights")}</h2>
        <p>{t("privacy.yourRightsContent")}</p>

        <h2>{t("privacy.contact")}</h2>
        <p>{t("privacy.contactContent")}</p>
      </article>
    </div>
  );
}
