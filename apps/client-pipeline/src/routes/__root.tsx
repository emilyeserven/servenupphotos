import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useMatches } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface RouterContext {
  queryClient: QueryClient;
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Lays the page out in a wider column, matched by the nav. */
    wide?: boolean;
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const wide = useMatches({ select: (matches) => matches.some((m) => m.staticData.wide) });
  return (
    <main className="min-h-svh bg-background text-foreground">
      <nav className={cn("mx-auto flex gap-4 px-6 pt-6 text-sm", wide ? "max-w-6xl" : "max-w-2xl")}>
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
        <Link
          to="/in-flight"
          className="text-muted-foreground [&.active]:text-foreground [&.active]:font-medium"
        >
          Photos in Flight
        </Link>
        <Link
          to="/settings"
          className="text-muted-foreground [&.active]:text-foreground [&.active]:font-medium"
        >
          Settings
        </Link>
      </nav>
      <Outlet />
    </main>
  );
}
