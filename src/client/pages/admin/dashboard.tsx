import { useMe, useAdminStats } from "@/client/queries/me";
import { Link } from "react-router-dom";

export function AdminDashboard() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";

  if (isAdmin) {
    return <AdminDashboardView />;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        欢迎回来
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        你可以在管理面板中管理你的笔记和评论。
      </p>
    </div>
  );
}

function AdminDashboardView() {
  const { data: stats, isLoading } = useAdminStats();

  const statCards = [
    {
      label: "已发布笔记",
      value: stats?.publishedNotes ?? 0,
      href: "/admin",
    },
    {
      label: "待审批用户",
      value: stats?.pendingUsers ?? 0,
      href: "/admin/users",
    },
    {
      label: "待审核评论",
      value: stats?.pendingComments ?? 0,
      href: "/admin/comments",
    },
    {
      label: "总用户数",
      value: stats?.totalUsers ?? 0,
      href: "/admin/users",
    },
  ];

  if (isLoading) {
    return <p className="text-gray-400">加载中...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        仪表盘
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            to={stat.href}
            className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
