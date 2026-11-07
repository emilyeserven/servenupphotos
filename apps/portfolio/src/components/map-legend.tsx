import { ChevronDown, ListTree } from "lucide-react";
import { useMap } from "@vis.gl/react-maplibre";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import {
  AreaSymbol,
  GroupSymbol,
  HopSymbol,
  NoImageSymbol,
  PhotoSymbol,
  RideSymbol,
  VisitSymbol,
  WalkSymbol,
} from "@/components/map-legend-symbols";
import type { MapDisplay } from "@/lib/map-display";
import { type LegendItems, legendItems } from "@/lib/map-legend";
import type { PlacedPhoto } from "@/lib/map-photos";
import { useIsDark } from "@/lib/map-theme";
import { type ShownArea, usePlaceArea } from "@/lib/place-areas";
import { useShownTripLines } from "@/lib/trip-lines-map";
import { cn } from "@/lib/utils";

/** One row of the key: whether it's listed, its sample, and what it means. */
type LegendRow = [shown: boolean, symbol: ReactNode, label: string];

/** The key's rows for the photos' markers. */
function pinRows(items: LegendItems): LegendRow[] {
  return [
    [items.photo, <PhotoSymbol key="photo" />, "Photo"],
    [items.group, <GroupSymbol key="group" />, "Group of photos"],
    [items.approximate, <PhotoSymbol approximate key="approximate" />, "Photo placed by its area"],
    [items.noImage, <NoImageSymbol key="no-image" />, "Photo without an image yet"],
  ];
}

/** The key's rows for the trip lines and areas under the markers. */
function lineRows(items: LegendItems, dark: boolean): LegendRow[] {
  return [
    [items.walk, <WalkSymbol dark={dark} key="walk" />, "Walk"],
    [
      items.rides.length > 0,
      <RideSymbol colors={items.rides} key="ride" />,
      "Bus, subway or train",
    ],
    [items.hop, <HopSymbol dark={dark} key="hop" />, "Other trip"],
    [items.visit, <VisitSymbol dark={dark} key="visit" />, "Place visited"],
    [items.area, <AreaSymbol dark={dark} key="area" />, "Area"],
  ];
}

/** Only the rows of what's on the map. */
function shownRows(rows: LegendRow[]): LegendRow[] {
  return rows.filter(([shown]) => shown);
}

const STORAGE_KEY = "servenup-map-legend-open";

/** Whether the key was left open in this browser; open on wider screens the first time. */
function readOpen(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? window.matchMedia("(min-width: 768px)").matches : stored === "true";
  } catch {
    // Storage can be blocked (private mode, disabled cookies).
    return false;
  }
}

/** Whether the key is open, and a function to open or close it, remembered in this browser. */
function useLegendOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(readOpen);
  function toggle() {
    try {
      localStorage.setItem(STORAGE_KEY, String(!open));
    } catch {
      // Ignore; it still opens or closes for this visit.
    }
    setOpen(!open);
  }
  return [open, toggle];
}

/**
 * The map's key, a panel in its bottom left corner: what its markers mean, and the trip lines,
 * places visited and areas it draws under them. It lists only what the map is drawing, and folds
 * down to its **Key** button, which phones start with.
 */
export function MapLegend({
  photos,
  display,
  area,
}: {
  /** The photos the map draws, whose days' trip lines it draws under them. */
  photos: PlacedPhoto[];
  display: MapDisplay;
  /** The place whose area is shaded, from the Places menu. */
  area: ShownArea;
}) {
  const [open, toggle] = useLegendOpen();
  const dark = useIsDark();
  const trips = useShownTripLines(photos, display.tripLines);
  const placeArea = usePlaceArea(area.id) !== undefined;
  const items = legendItems(photos, trips, placeArea);
  const groups = [shownRows(pinRows(items)), shownRows(lineRows(items, dark))];
  const container = useMap().current?.getContainer();
  if (!container) return null;
  // Drawn into the map itself, like its zoom buttons, rather than under the title with the controls.
  return createPortal(
    <section
      aria-label="Map key"
      className="absolute bottom-4 left-4 z-10 rounded-md border bg-background/90 text-sm shadow-xs backdrop-blur-sm dark:border-input"
    >
      <LegendToggle open={open} onToggle={toggle} />
      {open && <LegendList groups={groups} />}
    </section>,
    container,
  );
}

function LegendToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ListTree className="size-4 text-muted-foreground" aria-hidden />
      Key
      <ChevronDown
        className={cn(
          "ml-auto size-4 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  );
}

/** The key's rows: the pins, then the lines, with a line between them when there are both. */
function LegendList({ groups }: { groups: LegendRow[][] }) {
  const listed = groups.filter((rows) => rows.length > 0);
  if (listed.length === 0)
    return <p className="px-3 pb-2.5 text-muted-foreground">No photos on the map</p>;
  return (
    <div className="flex flex-col divide-y px-3 pb-1 dark:divide-input">
      {listed.map((rows) => (
        <LegendRows key={rows[0]![2]} rows={rows} />
      ))}
    </div>
  );
}

function LegendRows({ rows }: { rows: LegendRow[] }) {
  return (
    <ul className="flex flex-col gap-1 py-1.5">
      {rows.map(([, symbol, label]) => (
        <li key={label} className="flex items-center gap-2.5">
          {symbol}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
