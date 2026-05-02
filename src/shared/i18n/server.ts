import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

const messages: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

export function detectLocale(acceptLanguage?: string | null): "zh-CN" | "en" {
  if (!acceptLanguage) return "zh-CN";
  if (acceptLanguage.includes("zh")) return "zh-CN";
  return "en";
}

export function t(key: string, locale: string, params?: Record<string, string | number>): string {
  const dict = messages[locale] ?? messages["zh-CN"];
  let text = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{{${k}}}`, String(v));
    }
  }
  return text;
}
