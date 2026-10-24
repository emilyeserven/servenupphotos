import type { LucideIcon } from "lucide-react";
import { BookImage, CalendarClock, Grid3x3, MapPin, Palette } from "lucide-react";

export interface PortfolioView {
  to: "/timeline" | "/map" | "/albums" | "/grid" | "/color";
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
    to: "/map",
    label: "Map",
    description: "Photos plotted by where they were taken.",
    icon: MapPin,
    enabled: true,
  },
  {
    to: "/albums",
    label: "Albums",
    description: "The photos in each album, a strip for each.",
    icon: BookImage,
    enabled: true,
  },
  {
    to: "/grid",
    label: "Grid",
    description: "Every photo as a gallery grid, or as a sortable table of their details.",
    icon: Grid3x3,
    enabled: true,
  },
  {
    to: "/color",
    label: "Color",
    description: "Photos browsed by color and vividness.",
    icon: Palette,
    enabled: true,
  },
];

/** The views ready to visit, in menu order. */
export const enabledViews = portfolioViews.filter((view) => view.enabled);

export function getPortfolioView(to: PortfolioView["to"]): PortfolioView {
  const view = portfolioViews.find((v) => v.to === to);
  if (!view) throw new Error(`Unknown portfolio view: ${to}`);
  return view;
}
