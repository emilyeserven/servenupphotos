import { useMap } from "@vis.gl/react-maplibre";
import { ChevronsUpDown, Maximize, Navigation } from "lucide-react";
import { type LngLatBoundsLike } from "maplibre-gl";
import type { ReactNode } from "react";

/** An area of the map to jump to, with the bounds to fit. */
interface MapArea {
  name: string;
  /** South-west then north-east corners, as [longitude, latitude]. */
  bounds: [[number, number], [number, number]];
}

/** The areas the map can jump to. */
const MAP_AREAS: MapArea[] = [
  {
    name: "New York City",
    bounds: [
      [-74.26, 40.49],
      [-73.7, 40.92],
    ],
  },
  {
    name: "Seoul",
    bounds: [
      [126.76, 37.41],
      [127.18, 37.7],
    ],
  },
];

/** How far from the edges of the map an area is kept, in pixels. */
const AREA_PADDING = 40;

/**
 * A row of controls over the map, starting with a button group: a **Jump to** dropdown that zooms
 * straight to one of the areas in MAP_AREAS, and an icon button that goes back to the view that
 * shows every photo.
 */
export function MapViewControls({
  onReset,
  children,
}: {
  onReset: () => void;
  /** More controls for the same row, such as the day filter. */
  children?: ReactNode;
}) {
  const { current: map } = useMap();
  function showArea(bounds: LngLatBoundsLike) {
    map?.fitBounds(bounds, { padding: AREA_PADDING });
  }
  return (
    <div className="flex flex-wrap gap-2">
      <div className="inline-flex h-8 divide-x overflow-hidden rounded-md border bg-background text-sm text-muted-foreground shadow-xs dark:divide-input dark:border-input">
        <label className="relative inline-flex items-center">
          <Navigation className="pointer-events-none absolute left-2.5 size-4" aria-hidden />
          <span className="sr-only">Jump to an area</span>
          <select
            // Always back on "Jump to", as it's an action rather than a setting.
            value=""
            onChange={(event) => {
              const area = MAP_AREAS.find((choice) => choice.name === event.target.value);
              if (area) showArea(area.bounds);
            }}
            // Only as wide as "Jump to", rather than its longest area.
            className="h-full cursor-pointer appearance-none bg-transparent pr-8 pl-8 text-foreground outline-none [field-sizing:content] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <option value="" disabled>
              Jump to
            </option>
            {MAP_AREAS.map((area) => (
              <option key={area.name} value={area.name}>
                {area.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown
            className="pointer-events-none absolute right-2.5 size-4 opacity-50"
            aria-hidden
          />
        </label>
        <button
          type="button"
          onClick={onReset}
          title="Zoom out to every photo"
          aria-label="Zoom out to every photo"
          className="inline-flex w-8 items-center justify-center outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <Maximize className="size-4" aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
}
