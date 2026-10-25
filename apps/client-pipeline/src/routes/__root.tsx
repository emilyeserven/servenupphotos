import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, useLocation } from "@tanstack/react-router";
import type * as React from "react";
import { AppSidebar, navGroups } from "@/components/app-sidebar";
import { CombinedDataSync } from "@/components/combined-data-sync";
import { SyncStatus } from "@/components/sync-status";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });
  // A page under one in the sidebar, such as an album's, shows as that page.
  const isPage = (url: string) => pathname === url || pathname.startsWith(`${url}/`);
  const group = navGroups.find((g) => g.items.some((item) => isPage(item.url)));
  const page = group?.items.find((item) => isPage(item.url));
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
            {group && page ? (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">{group.title}</BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{page.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </header>
          <div className="flex-1">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
