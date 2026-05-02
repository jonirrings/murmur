import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSession } from "@/client/lib/auth-client";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

interface RequireAuthProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function RequireAuth({ children, requireAdmin = false }: RequireAuthProps) {
  const { t } = useTranslation("common");
  const { data, isPending } = useSession();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const location = routerState.location;

  useEffect(() => {
    if (!isPending && !data) {
      void navigate({ to: "/login", replace: true });
    }
  }, [isPending, data, navigate, location]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t("app.loading")}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (requireAdmin) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
