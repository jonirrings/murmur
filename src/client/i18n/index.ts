import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonZhCN from "./locales/zh-CN/common.json";
import commonEn from "./locales/en/common.json";
import commonJa from "./locales/ja/common.json";
import adminZhCN from "./locales/zh-CN/admin.json";
import adminEn from "./locales/en/admin.json";
import adminJa from "./locales/ja/admin.json";
import authZhCN from "./locales/zh-CN/auth.json";
import authEn from "./locales/en/auth.json";
import authJa from "./locales/ja/auth.json";
import editorZhCN from "./locales/zh-CN/editor.json";
import editorEn from "./locales/en/editor.json";
import editorJa from "./locales/ja/editor.json";
import commentsZhCN from "./locales/zh-CN/comments.json";
import commentsEn from "./locales/en/comments.json";
import commentsJa from "./locales/ja/comments.json";

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": {
        common: commonZhCN,
        admin: adminZhCN,
        auth: authZhCN,
        editor: editorZhCN,
        comments: commentsZhCN,
      },
      en: {
        common: commonEn,
        admin: adminEn,
        auth: authEn,
        editor: editorEn,
        comments: commentsEn,
      },
      ja: {
        common: commonJa,
        admin: adminJa,
        auth: authJa,
        editor: editorJa,
        comments: commentsJa,
      },
    },
    supportedLngs: ["zh-CN", "en", "ja"],
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "admin", "auth", "editor", "comments"],
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "murmur-lng",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
