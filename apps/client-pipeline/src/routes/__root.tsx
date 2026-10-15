import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <main className="min-h-svh bg-background text-foreground">
      <nav className="mx-auto flex max-w-2xl gap-4 px-6 pt-6 text-sm">
        <Link
          to="/"
          className="text-muted-foreground [&.active]:text-foreground [&.active]:font-medium"
        >
          Status
        </Link>
        <Link
          to="/exif"
          className="text-muted-foreground [&.active]:text-foreground [&.active]:font-medium"
        >
          EXIF
        </Link>
      </nav>
      <Outlet />
    </main>
  ),
});
