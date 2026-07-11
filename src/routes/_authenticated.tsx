import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { Loader2 } from "lucide-react";
import { PresenceTracker } from "@/hooks/use-presence";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  // Production-only lockdown: only /commandes/* is accessible
  const productionOnly =
    !loading &&
    !!user &&
    roles.includes("production") &&
    !roles.some((r) => r === "super_admin" || r === "admin");

  useEffect(() => {
    const isAllowedProductionPath = pathname === "/commandes" || /^\/commandes\/[0-9a-f-]{36}$/i.test(pathname);
    if (productionOnly && !isAllowedProductionPath) {
      navigate({ to: "/commandes", replace: true });
    }
  }, [productionOnly, pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <PresenceTracker />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}