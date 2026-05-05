/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { HtmlDocument } from "./layout";
import { t } from "@/shared/i18n/server";

interface AboutPageProps {
  locale: string;
}

const GITHUB_URL = "https://github.com/your-org/murmur";

export const AboutPage: FC<AboutPageProps> = ({ locale }) => {
  return (
    <HtmlDocument title={t("about.title", locale)} locale={locale}>
      <article class="prose">
        <h1>{t("about.title", locale)}</h1>
        <p>{t("about.description", locale)}</p>

        <h2>{t("about.features", locale)}</h2>
        <ul>
          <li>{t("about.feature1", locale)}</li>
          <li>{t("about.feature2", locale)}</li>
          <li>{t("about.feature3", locale)}</li>
          <li>{t("about.feature4", locale)}</li>
          <li>{t("about.feature5", locale)}</li>
        </ul>

        <h2>{t("about.openSource", locale)}</h2>
        <p>{t("about.openSourceDesc", locale)}</p>
        <p>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            {t("about.viewOnGithub", locale)}
          </a>
        </p>
      </article>
    </HtmlDocument>
  );
};
