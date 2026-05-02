import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18next from "i18next";

type Locale = "zh-CN" | "en";

interface UiState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  locale: Locale;
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocale: (locale: Locale) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",
      locale: "zh-CN",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => {
        set({ locale });
        void i18next.changeLanguage(locale);
        document.documentElement.lang = locale;
      },
    }),
    { name: "murmur-ui" },
  ),
);
