import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18next from "i18next";

type Locale = "zh-CN" | "en" | "ja";
type CookieConsent = "all" | "essential" | undefined;

interface UiState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  locale: Locale;
  cookieConsent: CookieConsent;
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocale: (locale: Locale) => void;
  setCookieConsent: (consent: CookieConsent) => void;
}

function readCookieConsent(): CookieConsent {
  const match = document.cookie.match(/murmur-cookie-consent=(all|essential)/);
  return match ? (match[1] as "all" | "essential") : undefined;
}

function writeCookieConsent(consent: "all" | "essential") {
  document.cookie = `murmur-cookie-consent=${consent};path=/;max-age=31536000;SameSite=Lax`;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",
      locale: "zh-CN",
      cookieConsent: readCookieConsent(),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => {
        set({ locale });
        void i18next.changeLanguage(locale);
        document.documentElement.lang = locale;
      },
      setCookieConsent: (consent) => {
        if (consent) writeCookieConsent(consent);
        set({ cookieConsent: consent });
      },
    }),
    { name: "murmur-ui" },
  ),
);
