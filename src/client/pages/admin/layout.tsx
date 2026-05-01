import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/client/lib/auth-client";
import { useMe } from "@/client/queries/me";

export function AdminLayout() {
  const { data: sessionData, isPending: sessionPending } = useSession();
  const { data: me, isLoading: meLoading } = useMe();
  const navigate = useNavigate();

  const isLoading = sessionPending || meLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!sessionData?.user) {
    navigate("/login", { replace: true });
    return null;
  }

  const isAdmin = me?.role === "admin";
  const isAuthor = me?.role === "author";

  // Only admin and author can access admin panel
  if (me && me.role === "commenter") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">权限不足</h2>
          <p className="text-gray-500">需要作者或管理员权限才能访问此页面。</p>
        </div>
      </div>
    );
  }

  if (me && me.approvalStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">等待审批</h2>
          <p className="text-gray-500">您的账号正在等待管理员审批。</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded text-sm ${
      isActive
        ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white shadow dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Murmur
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {sessionData.user.name ?? sessionData.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 flex gap-6">
        <aside className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            <NavLink to="/admin" end className={linkClass}>
              仪表盘
            </NavLink>
            {isAdmin && (
              <>
                <NavLink to="/admin/users" className={linkClass}>
                  用户管理
                </NavLink>
                <NavLink to="/admin/comments" className={linkClass}>
                  评论管理
                </NavLink>
                <NavLink to="/admin/settings" className={linkClass}>
                  站点设置
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
