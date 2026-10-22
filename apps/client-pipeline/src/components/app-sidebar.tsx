import { Link, useLocation } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useCombinedSync } from "@/stores/combined-data";

/** Every page in the app, grouped the way the sidebar shows them. */
export const navGroups = [
  {
    title: "Pipeline",
    items: [
      { title: "Status", url: "/" },
      { title: "Photo", url: "/exif" },
      { title: "Photos in Flight", url: "/in-flight" },
      { title: "Gallery", url: "/gallery" },
      { title: "Explore Bucket", url: "/bucket" },
      { title: "Manage Sizes", url: "/sizes" },
    ],
  },
  {
    title: "Organize",
    items: [
      { title: "Albums", url: "/albums" },
      { title: "Tags", url: "/tags" },
    ],
  },
  {
    title: "Publish",
    items: [
      { title: "Instagram", url: "/instagram" },
      { title: "Site Spotlight", url: "/site-spotlight" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "Settings", url: "/settings" },
      { title: "Update Data", url: "/update-data" },
    ],
  },
] as const;

/** Floating sidebar navigation, adapted from shadcn's sidebar-04 block. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();
  // On mobile the sidebar is a sheet over the page, so close it after navigating.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" onClick={closeOnMobile}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Camera className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Photo Pipeline</span>
                  <span className="text-xs text-muted-foreground">Local control panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {navGroups.map((group) => (
              <SidebarMenuItem key={group.title}>
                <span className="flex h-8 items-center px-2 text-sm font-medium">
                  {group.title}
                </span>
                <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                  {group.items.map((item) => (
                    <SidebarMenuSubItem key={item.url}>
                      <SidebarMenuSubButton asChild isActive={pathname === item.url}>
                        <Link to={item.url} onClick={closeOnMobile}>
                          {item.title}
                          {item.url === "/in-flight" && <SyncBadge />}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

/**
 * Beside Photos in Flight: a spinner while ALLPHOTOS.json is being rebuilt, or a dot when it's
 * missing changes pushed to the pull request.
 */
function SyncBadge() {
  const { unsynced, rebuilding } = useCombinedSync();
  if (rebuilding) return <Spinner className="ml-auto size-3.5" aria-label="Rebuilding" />;
  if (!unsynced) return null;
  return (
    <span
      className="ml-auto flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
      title="Not synced to ALLPHOTOS.json yet"
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      Not synced
    </span>
  );
}
