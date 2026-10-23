import { Link, useLocation } from "@tanstack/react-router";
import {
  ApertureIcon,
  ActivityIcon,
  BookImageIcon,
  CalendarDaysIcon,
  CameraIcon,
  Camera,
  DatabaseIcon,
  ImageIcon,
  LanguagesIcon,
  LayoutGridIcon,
  MapPinIcon,
  PlaneIcon,
  RefreshCwIcon,
  ScalingIcon,
  SettingsIcon,
  SparklesIcon,
  TagsIcon,
} from "lucide-react";
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
import { UploadButtons } from "@/components/upload-buttons";

/** Every page in the app, grouped the way the sidebar shows them, with the icon it has when collapsed. */
export const navGroups = [
  {
    title: "Pipeline",
    items: [
      { title: "Status", url: "/", icon: ActivityIcon },
      { title: "Photo", url: "/exif", icon: ImageIcon },
      { title: "Photos in Flight", url: "/in-flight", icon: PlaneIcon },
      { title: "Gallery", url: "/gallery", icon: LayoutGridIcon },
      { title: "Explore Bucket", url: "/bucket", icon: DatabaseIcon },
      { title: "Manage Sizes", url: "/sizes", icon: ScalingIcon },
    ],
  },
  {
    title: "Organize",
    items: [
      { title: "Albums", url: "/albums", icon: BookImageIcon },
      { title: "Tags", url: "/tags", icon: TagsIcon },
    ],
  },
  {
    title: "Publish",
    items: [
      { title: "Instagram", url: "/instagram", icon: CalendarDaysIcon },
      { title: "Site Spotlight", url: "/site-spotlight", icon: SparklesIcon },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "Settings", url: "/settings", icon: SettingsIcon },
      { title: "Update Data", url: "/update-data", icon: RefreshCwIcon },
      { title: "Places", url: "/places", icon: MapPinIcon },
      { title: "Localizations", url: "/localizations", icon: LanguagesIcon },
      { title: "Metadata Groups", url: "/metadata-groups", icon: ApertureIcon },
      { title: "Camera Overrides", url: "/camera-overrides", icon: CameraIcon },
    ],
  },
] as const;

/**
 * Floating sidebar navigation, adapted from shadcn's sidebar-04 block. Its button at the bottom collapses
 * it to a rail of icons, each naming its page in a tooltip.
 */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = useLocation({ select: (location) => location.pathname });
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
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-sm text-sidebar-foreground">
              {group.title}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} onClick={closeOnMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarCollapseButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
