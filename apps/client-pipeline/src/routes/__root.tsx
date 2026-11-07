import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { NavBreadcrumbs } from "@/components/sidebar/nav-breadcrumbs";
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
    /** The name of a page under one in the sidebar, such as "Import", shown after it in the breadcrumb. */
    subpage?: string;
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
          <div className="flex-1">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
