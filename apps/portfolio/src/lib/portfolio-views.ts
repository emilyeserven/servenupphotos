import type { LucideIcon } from "lucide-react";
import { shownOriginals } from "virtual:shown-originals";
import {
  BookImage,
  CalendarClock,
  ChartColumn,
  Dices,
  Hash,
  Grid3x3,
  Heart,
  MapPin,
  Palette,
  SquareSplitHorizontal,
  Tags,
} from "lucide-react";

export interface PortfolioView {
  to:
    | "/timeline"
    | "/map"
    | "/albums"
    | "/tags"
    | "/stats"
    | "/graph"
    | "/grid"
    | "/color"
    | "/lucky"
    | "/likes"
    | "/raw-vs-edited";
  label: string;
  description: string;
  icon: LucideIcon;
  /** False for a view that's linked but not ready to visit yet. */
  enabled: boolean;
  /**
   * True for a lesser view (Albums, Tags, Numbers, Graph, Lucky, My Likes, Raw vs Edited): the site menu lists it in small text under the
   * big icon tiles, and the homepage leaves it out.
   */
  minor?: boolean;
}

// In the order the site menu and the homepage show them: Map, Timeline, Color and Grid as the big tiles.
const portfolioViews: PortfolioView[] = [
  {
    to: "/map",
    label: "Map",
    description: "Photos plotted by where they were taken.",
    icon: MapPin,
    enabled: true,
  },
  {
    to: "/timeline",
    label: "Timeline",
    description: "Photos arranged chronologically by when they were taken.",
    icon: CalendarClock,
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
    to: "/grid",
    label: "Grid",
    description: "Every photo as a gallery grid, or as a sortable table of their details.",
    icon: Grid3x3,
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
    label: "Numbers",
    description: "The photos counted by gear, place and time.",
    icon: Hash,
    enabled: true,
    minor: true,
  },
  {
    to: "/graph",
    label: "Graph",
    description:
      "A graph of your own from the Numbers page's counts, as bars, lines, a pie or dots.",
    icon: ChartColumn,
    enabled: true,
    minor: true,
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
  {
    to: "/raw-vs-edited",
    label: "Raw vs Edited",
    description: "A few photos next to their unedited originals, to see what editing changed.",
    icon: SquareSplitHorizontal,
    enabled: true,
    minor: true,
  },
];

/** The main views, shown as big icon tiles in the site menu and on the homepage. */
export const mainViews = portfolioViews.filter((view) => !view.minor);

/** Whether a view has anything to show: Raw vs Edited only once a photo's original is shown. */
function hasContent(view: PortfolioView): boolean {
  return view.to !== "/raw-vs-edited" || shownOriginals > 0;
}

/** The lesser views, listed in small text under the site menu's tiles. */
export const minorViews = portfolioViews.filter((view) => view.minor && hasContent(view));

export function getPortfolioView(to: PortfolioView["to"]): PortfolioView {
  const view = portfolioViews.find((v) => v.to === to);
  if (!view) throw new Error(`Unknown portfolio view: ${to}`);
  return view;
}
