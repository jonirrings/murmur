/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { HtmlDocument } from "./layout";
import { t } from "@/shared/i18n/server";

interface PrivacyPageProps {
  locale: string;
}

export const PrivacyPage: FC<PrivacyPageProps> = ({ locale }) => {
  const lastUpdated = "2026-05-05";
  return (
    <HtmlDocument title={t("privacy.title", locale)} locale={locale}>
      <article class="prose">
        <h1>{t("privacy.title", locale)}</h1>
        <p>
          <small>{t("privacy.lastUpdated", locale, { date: lastUpdated })}</small>
        </p>

        <p>{t("privacy.intro", locale)}</p>

        <h2>{t("privacy.infoCollect", locale)}</h2>
        <p>{t("privacy.infoCollectContent", locale)}</p>

        <h2>{t("privacy.howWeUse", locale)}</h2>
        <p>{t("privacy.howWeUseContent", locale)}</p>

        <h2>{t("privacy.cookies", locale)}</h2>
        <p>{t("privacy.cookiesContent", locale)}</p>

        <h2>{t("privacy.dataSharing", locale)}</h2>
        <p>{t("privacy.dataSharingContent", locale)}</p>

        <h2>{t("privacy.dataRetention", locale)}</h2>
        <p>{t("privacy.dataRetentionContent", locale)}</p>

        <h2>{t("privacy.yourRights", locale)}</h2>
        <p>{t("privacy.yourRightsContent", locale)}</p>

        <h2>{t("privacy.contact", locale)}</h2>
        <p>{t("privacy.contactContent", locale)}</p>
      </article>
    </HtmlDocument>
  );
};
