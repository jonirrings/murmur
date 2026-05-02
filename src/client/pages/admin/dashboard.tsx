import { useMe, useAdminStats } from "@/client/queries/me";
import { useSiteWideOnlineCount } from "@/client/queries/visitor-counter";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function AdminDashboard() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";

  if (isAdmin) {
    return <AdminDashboardView />;
  }

  return <AuthorDashboard />;
}

function AuthorDashboard() {
  const { t } = useTranslation("admin");
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        {t("dashboard.welcome")}
      </h2>
      <p className="text-gray-600 dark:text-gray-400">{t("dashboard.welcomeDesc")}</p>
    </div>
  );
}

function AdminDashboardView() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: visitorCounts } = useSiteWideOnlineCount();
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  const totalOnline = visitorCounts ? Object.values(visitorCounts).reduce((a, b) => a + b, 0) : 0;

  const statCards = [
    {
      label: t("dashboard.publishedNotes"),
      value: stats?.publishedNotes ?? 0,
      href: "/admin",
    },
    {
      label: t("dashboard.pendingUsers"),
      value: stats?.pendingUsers ?? 0,
      href: "/admin/users",
    },
    {
      label: t("dashboard.pendingComments"),
      value: stats?.pendingComments ?? 0,
      href: "/admin/comments",
    },
    {
      label: t("dashboard.totalUsers"),
      value: stats?.totalUsers ?? 0,
      href: "/admin/users",
    },
    {
      label: t("dashboard.onlineVisitors"),
      value: totalOnline,
      href: "/admin",
    },
  ];

  if (isLoading) {
    return <p className="text-gray-400">{tc("app.loading")}</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        {t("dashboard.title")}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            to={stat.href}
            className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
