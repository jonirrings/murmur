import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

const messages: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
  ja,
};

export function t(key: string, locale: string, params?: Record<string, string | number>): string {
  const dict = messages[locale] ?? messages.en;
  let text = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{{${k}}}`, String(v));
    }
  }
  return text;
}
