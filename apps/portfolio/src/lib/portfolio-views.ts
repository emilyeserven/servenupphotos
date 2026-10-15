import type { LucideIcon } from "lucide-react";
import { CalendarClock, Grid3x3, MapPin, Palette, Sparkles, Table } from "lucide-react";

export interface PortfolioView {
  to: "/timeline" | "/table" | "/map" | "/spotlight" | "/grid" | "/color";
  label: string;
  description: string;
  icon: LucideIcon;
}

const portfolioViews: PortfolioView[] = [
  {
    to: "/timeline",
    label: "Timeline",
    description: "Photos arranged chronologically by when they were taken.",
    icon: CalendarClock,
  },
  {
    to: "/table",
    label: "Table",
    description: "A sortable list of photos with their metadata.",
    icon: Table,
  },
  {
    to: "/map",
    label: "Map",
    description: "Photos plotted by where they were taken.",
    icon: MapPin,
  },
  {
    to: "/spotlight",
    label: "Spotlight",
    description: "One featured photo at a time, shown large.",
    icon: Sparkles,
  },
  {
    to: "/grid",
    label: "Grid",
    description: "A gallery grid of every photo.",
    icon: Grid3x3,
  },
  {
    to: "/color",
    label: "Color",
    description: "Photos grouped and browsed by dominant color.",
    icon: Palette,
  },
];

export function getPortfolioView(to: PortfolioView["to"]): PortfolioView {
  const view = portfolioViews.find((v) => v.to === to);
  if (!view) throw new Error(`Unknown portfolio view: ${to}`);
  return view;
}
