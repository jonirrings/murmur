import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/client/components/theme-provider";
import { LocaleSync } from "@/client/app";
import { CookieConsent } from "@/client/components/cookie-consent";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LocaleSync />
        <Outlet />
        <CookieConsent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
