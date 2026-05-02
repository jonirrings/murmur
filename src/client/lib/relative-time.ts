import i18next from "i18next";

export function formatRelativeTime(dateStr: string): string {
  const t = i18next.getFixedT(i18next.language, "common");
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return t("time.justNow");
  if (diffMin < 60) return t("time.minutesAgo", { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("time.hoursAgo", { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  return t("time.daysAgo", { count: diffDay });
}

export function formatDateLocale(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(
      i18next.language,
      options ?? { year: "numeric", month: "2-digit", day: "2-digit" },
    );
  } catch {
    return dateStr;
  }
}
