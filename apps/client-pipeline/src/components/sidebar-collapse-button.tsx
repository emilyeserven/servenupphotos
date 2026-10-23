import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/**
 * The button at the bottom of the sidebar that collapses it to a rail of icons and expands it again.
 * On a phone the sidebar is a sheet that always shows in full, so the button isn't shown there.
 */
export function SidebarCollapseButton() {
  const { open, isMobile, toggleSidebar } = useSidebar();
  if (isMobile) return null;
  const label = open ? "Collapse sidebar" : "Expand sidebar";
  const Icon = open ? PanelLeftCloseIcon : PanelLeftOpenIcon;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={toggleSidebar}
          tooltip={`${label} (Ctrl+B)`}
          className="text-muted-foreground"
        >
          <Icon />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
