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

/** The key's rows, in order: the photos' markers, then the trip lines and areas. */
function legendRows(items: LegendItems, dark: boolean): LegendRow[] {
  return [
    [true, <PhotoSymbol key="photo" />, "Photo"],
    [true, <GroupSymbol key="group-of-photos" />, "Group of photos"],
    [
      items.approximate,
      <PhotoSymbol approximate key="photo-placed-by-its-area" />,
      "Photo placed by its area",
    ],
    [
      items.noImage,
      <NoImageSymbol key="photo-without-an-image-yet" />,
      "Photo without an image yet",
    ],
    [items.walk, <WalkSymbol dark={dark} key="walk" />, "Walk"],
    [
      items.rides.length > 0,
      <RideSymbol colors={items.rides} key="bus-subway-or-train" />,
      "Bus, subway or train",
    ],
    [items.hop, <HopSymbol dark={dark} key="other-trip" />, "Other trip"],
    [items.visit, <VisitSymbol dark={dark} key="place-visited" />, "Place visited"],
    [items.area, <AreaSymbol dark={dark} key="area" />, "Area"],
  ];
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
  /** The photos the map draws. */
  photos: PlacedPhoto[];
  display: MapDisplay;
  /** The place whose area is shaded, from the Places menu. */
  area: ShownArea;
}) {
  const [open, toggle] = useLegendOpen();
  const dark = useIsDark();
  const trips = useShownTripLines(photos, display.tripLines);
  const placeArea = usePlaceArea(area.id) !== undefined;
  const rows = legendRows(legendItems(photos, trips, placeArea), dark).filter(([shown]) => shown);
  const container = useMap().current?.getContainer();
  if (!container) return null;
  // Drawn into the map itself, like its zoom buttons, rather than under the title with the controls.
  return createPortal(
    <section
      aria-label="Map key"
      className="absolute bottom-4 left-4 z-10 rounded-md border bg-background/90 text-sm shadow-xs backdrop-blur-sm dark:border-input"
    >
      <LegendToggle open={open} onToggle={toggle} />
      {open && <LegendList rows={rows} />}
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

function LegendList({ rows }: { rows: LegendRow[] }) {
  return (
    <ul className="flex flex-col gap-1 px-3 pt-0.5 pb-2.5">
      {rows.map(([, symbol, label]) => (
        <li key={label} className="flex items-center gap-2.5">
          {symbol}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
