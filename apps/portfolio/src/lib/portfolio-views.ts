import type { LucideIcon } from "lucide-react";
import { CalendarClock, Grid3x3, MapPin, Palette, Sparkles, Table } from "lucide-react";

export interface PortfolioView {
  to: "/timeline" | "/table" | "/map" | "/spotlight" | "/grid" | "/color";
  label: string;
  description: string;
  icon: LucideIcon;
  /** False for a view that's linked but not ready to visit yet. */
  enabled: boolean;
}

export const portfolioViews: PortfolioView[] = [
  {
    to: "/timeline",
    label: "Timeline",
    description: "Photos arranged chronologically by when they were taken.",
    icon: CalendarClock,
    enabled: true,
  },
  {
    to: "/table",
    label: "Table",
    description: "A sortable list of photos with their metadata.",
    icon: Table,
    enabled: true,
  },
  {
    to: "/map",
    label: "Map",
    description: "Photos plotted by where they were taken.",
    icon: MapPin,
    enabled: true,
  },
  {
    to: "/spotlight",
    label: "Spotlight",
    description: "One featured photo at a time, shown large.",
    icon: Sparkles,
    enabled: false,
  },
  {
    to: "/grid",
    label: "Grid",
    description: "A gallery grid of every photo.",
    icon: Grid3x3,
    enabled: true,
  },
  {
    to: "/color",
    label: "Color",
    description: "Photos grouped and browsed by dominant color.",
    icon: Palette,
    enabled: false,
  },
];

/** The views ready to visit, in menu order. */
export const enabledViews = portfolioViews.filter((view) => view.enabled);

export function getPortfolioView(to: PortfolioView["to"]): PortfolioView {
  const view = portfolioViews.find((v) => v.to === to);
  if (!view) throw new Error(`Unknown portfolio view: ${to}`);
  return view;
}
