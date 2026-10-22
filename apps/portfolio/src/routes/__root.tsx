import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { SiteMenu } from "@/components/site-menu";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <main className="min-h-svh bg-background text-foreground">
      <div className="fixed top-4 right-4 z-40">
        <SiteMenu />
      </div>
      <Outlet />
    </main>
  ),
});
