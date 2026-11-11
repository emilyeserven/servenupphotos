import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarCollapseButton } from "@/components/sidebar-collapse-button";
import { navGroups } from "@/components/sidebar/nav-groups";
import { NavItem } from "@/components/sidebar/nav-item";
import { QuickEditButton } from "@/components/quick-edit-button";
import { ThemeButton } from "@/components/theme-button";
import { UploadButtons } from "@/components/upload-buttons";

/**
 * Floating sidebar navigation, adapted from shadcn's sidebar-04 block. Pages with pages under them, such as Tags, have a submenu
 * (`components/sidebar/`). Its buttons at the bottom switch
 * the color theme and collapse it to a rail of icons, each naming its page in a tooltip.
 */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
  // On mobile the sidebar is a sheet over the page, so close it after navigating.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar variant="floating" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Photo Pipeline" asChild>
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
        <UploadButtons onNavigate={closeOnMobile} />
        <QuickEditButton onNavigate={closeOnMobile} />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-sm text-sidebar-foreground">
              {group.title}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((page) => (
                <NavItem key={page.url} page={page} onNavigate={closeOnMobile} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <ThemeButton />
        <SidebarCollapseButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
