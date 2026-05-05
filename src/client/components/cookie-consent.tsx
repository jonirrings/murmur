import { useTranslation } from "react-i18next";
import { useUiStore } from "@/client/stores/ui-store";

export function CookieConsent() {
  const { t } = useTranslation("common");
  const cookieConsent = useUiStore((s) => s.cookieConsent);
  const setCookieConsent = useUiStore((s) => s.setCookieConsent);

  if (cookieConsent !== undefined) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-4 shadow-lg sm:p-6 dark:border-border dark:bg-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">{t("cookie.title")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("cookie.description")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setCookieConsent("essential")}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t("cookie.acceptEssential")}
            </button>
            <button
              type="button"
              onClick={() => setCookieConsent("all")}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("cookie.acceptAll")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
