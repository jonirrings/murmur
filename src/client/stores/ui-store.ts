import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "murmur-ui" },
  ),
);
