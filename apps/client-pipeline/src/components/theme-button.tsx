import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { type ThemeMode, useThemeStore } from "@/stores/theme";

/** Each mode's name, icon, and the mode a click switches to. */
const modes = {
  light: { label: "Light", icon: SunIcon, next: "dark" },
  dark: { label: "Dark", icon: MoonIcon, next: "system" },
  system: { label: "System", icon: MonitorIcon, next: "light" },
} as const satisfies Record<ThemeMode, { label: string; icon: typeof SunIcon; next: ThemeMode }>;

/**
 * The button at the bottom of the sidebar that switches between light, dark and system colors, one
 * click at a time. The choice is kept in the browser.
 */
export function ThemeButton() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const { label, icon: Icon, next } = modes[mode];
  const nextLabel = modes[next].label;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => setMode(next)}
          tooltip={`Theme: ${label} (click for ${nextLabel})`}
          aria-label={`Theme: ${label}. Switch to ${nextLabel}`}
          className="text-muted-foreground"
        >
          <Icon />
          <span>Theme: {label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
