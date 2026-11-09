import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { NavBreadcrumbs } from "@/components/sidebar/nav-breadcrumbs";
import type { RouteCrumbs } from "@/components/sidebar/route-crumbs";
import { InFlightBackupKeeper } from "@/components/in-flight-backup-keeper";
import { CombinedDataSync } from "@/components/combined-data-sync";
import { SyncStatus } from "@/components/sync-status";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/stores/sidebar";

interface RouterContext {
  queryClient: QueryClient;
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Lays the page out in a wider column. */
    wide?: boolean;
    /**
     * The breadcrumbs after the sidebar's pages, such as an album's name or a day's Route page.
     */
    crumbs?: RouteCrumbs;
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const sidebarOpen = useSidebarStore((state) => state.open);
  const setSidebarOpen = useSidebarStore((state) => state.setOpen);

  return (
    // Every tooltip, like the collapsed sidebar's page names, shares one provider.
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        // Just wide enough for the widest line, "Local control panel" beside its icon, plus a little room.
        style={{ "--sidebar-width": "13rem" } as React.CSSProperties}
      >
        <CombinedDataSync />
        <InFlightBackupKeeper />
        <SyncStatus />
        <AppSidebar />
        {/* min-w-0 lets wide content, like a table, scroll inside the page instead of widening it. */}
        <SidebarInset className="min-w-0">
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            {/* On a phone the sidebar is a sheet, opened from here; on wider screens it collapses from its own button. */}
            <SidebarTrigger className="-ml-1 md:hidden" title="Open the sidebar" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4 md:hidden"
            />
            <NavBreadcrumbs />
          </header>
          {/* Only the page fades when switching pages; the sidebar and breadcrumbs stay. */}
          <div className="flex-1 [view-transition-name:page]">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
