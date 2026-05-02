import { useUiStore } from "./stores/ui-store";
import i18next from "i18next";

export function LocaleSync() {
  const locale = useUiStore((s) => s.locale);
  if (i18next.language !== locale) {
    void i18next.changeLanguage(locale);
  }
  return null;
}
