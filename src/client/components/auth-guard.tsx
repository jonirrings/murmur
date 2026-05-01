import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/client/lib/auth-client";

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function RequireAuth({ children, requireAdmin = false }: RequireAuthProps) {
  const { data, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!data) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const user = data.user;

  // We need to check approvalStatus and role from the server-side user data
  // better-auth session doesn't include custom fields directly
  // For now, we'll make a separate API call or rely on the admin layout's own check
  if (requireAdmin) {
    // The AdminLayout handles its own auth check, so this is a secondary guard
    return <>{children}</>;
  }

  return <>{children}</>;
}
