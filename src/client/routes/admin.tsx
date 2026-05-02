import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession, signOut } from "@/client/lib/auth-client";
import { useMe } from "@/client/queries/me";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { useUiStore } from "@/client/stores/ui-store";
import { Menu, X } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { data: sessionData, isPending: sessionPending } = useSession();
  const { data: me, isLoading: meLoading } = useMe();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation("common");
  const { locale, setLocale } = useUiStore();

  const isLoading = sessionPending || meLoading;

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t("app.loading")}</p>
      </div>
    );
  }

  if (!sessionData?.user) {
    void navigate({ to: "/login", replace: true });
    return null;
  }

  const isAdmin = me?.role === "admin";
  const isAuthor = me?.role === "author";

  if (me && me.role === "commenter") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("apiErrors.forbidden")}</h2>
          <p className="text-gray-500">{t("auth.permissionDeniedDesc")}</p>
        </div>
      </div>
    );
  }

  if (me && me.approvalStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("auth.approvalPendingTitle")}</h2>
          <p className="text-gray-500">{t("auth.approvalPendingDesc")}</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white shadow dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Murmur</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
              className="rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {locale === "zh-CN" ? "EN" : "中"}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
              {sessionData.user.name ?? sessionData.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-red-600 dark:text-gray-400"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 flex gap-6">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-48 bg-white border-r border-gray-200 p-4 pt-20 transform transition-transform duration-200 lg:static lg:translate-x-0 lg:bg-transparent lg:border-0 lg:p-0 lg:pt-0 dark:bg-gray-800 dark:border-gray-700 lg:dark:bg-transparent ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="space-y-1">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300",
              }}
              className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("nav.dashboard")}
            </Link>
            {(isAdmin || isAuthor) && (
              <Link
                to="/admin/notes"
                activeProps={{
                  className:
                    "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300",
                }}
                className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t("nav.myNotes")}
              </Link>
            )}
            {isAdmin && (
              <>
                <Link
                  to="/admin/users"
                  activeProps={{
                    className:
                      "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300",
                  }}
                  className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("nav.users")}
                </Link>
                <Link
                  to="/admin/comments"
                  activeProps={{
                    className:
                      "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300",
                  }}
                  className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("nav.comments")}
                </Link>
                <Link
                  to="/admin/settings"
                  activeProps={{
                    className:
                      "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300",
                  }}
                  className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("nav.settings")}
                </Link>
              </>
            )}
            <Link
              to="/admin/security"
              activeProps={{
                className:
                  "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300",
              }}
              className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("nav.security")}
            </Link>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
