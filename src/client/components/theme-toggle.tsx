import { useUiStore } from "@/client/stores/ui-store";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const { t } = useTranslation("common");

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const label =
    theme === "light" ? t("theme.light") : theme === "dark" ? t("theme.dark") : t("theme.system");

  return (
    <button
      onClick={cycle}
      title={t("theme.currentToggle", { label })}
      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    >
      {theme === "light" ? (
        <Sun className="h-5 w-5" />
      ) : theme === "dark" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Monitor className="h-5 w-5" />
      )}
    </button>
  );
}
