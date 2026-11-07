import type { LucideIcon } from "lucide-react";
import {
  BookImage,
  CalendarClock,
  ChartColumn,
  Dices,
  Grid3x3,
  Heart,
  MapPin,
  Palette,
  Tags,
} from "lucide-react";

export interface PortfolioView {
  to:
    | "/timeline"
    | "/map"
    | "/albums"
    | "/tags"
    | "/stats"
    | "/grid"
    | "/color"
    | "/lucky"
    | "/likes";
  label: string;
  description: string;
  icon: LucideIcon;
  /** False for a view that's linked but not ready to visit yet. */
  enabled: boolean;
  /**
   * True for a lesser view (Albums, Tags, Stats, Lucky, My Likes): the site menu lists it in small text under the
   * big icon tiles, and the homepage leaves it out.
   */
  minor?: boolean;
}

const portfolioViews: PortfolioView[] = [
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
    minor: true,
  },
  {
    to: "/tags",
    label: "Tags",
    description: "Every tag with a few of its photos, each tag under its parent tag.",
    icon: Tags,
    enabled: true,
    minor: true,
  },
  {
    to: "/stats",
    label: "Stats",
    description: "The photos counted by gear, place and time.",
    icon: ChartColumn,
    enabled: true,
    minor: true,
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
  {
    to: "/lucky",
    label: "Lucky",
    description:
      "A few rows of photos picked at random, from all of them or the ones the filters leave.",
    icon: Dices,
    enabled: true,
    minor: true,
  },
  {
    to: "/likes",
    label: "My Likes",
    description: "The photos liked in this browser, with a list of their titles to copy.",
    icon: Heart,
    enabled: true,
    minor: true,
  },
];

/** The main views, shown as big icon tiles in the site menu and on the homepage. */
export const mainViews = portfolioViews.filter((view) => !view.minor);

/** The lesser views, listed in small text under the site menu's tiles. */
export const minorViews = portfolioViews.filter((view) => view.minor);

export function getPortfolioView(to: PortfolioView["to"]): PortfolioView {
  const view = portfolioViews.find((v) => v.to === to);
  if (!view) throw new Error(`Unknown portfolio view: ${to}`);
  return view;
}
