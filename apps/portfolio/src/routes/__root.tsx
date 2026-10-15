import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  ),
});
