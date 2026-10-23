import { useMap } from "@vis.gl/react-maplibre";
import { Maximize, Navigation } from "lucide-react";
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

const CONTROL_BUTTON =
  "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4";

/**
 * A row of controls over the map: a button to go back to the view that shows every photo, and a
 * **Jump to** dropdown that zooms straight to one of the areas in MAP_AREAS.
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
      <div className="inline-flex rounded-md border bg-background p-0.5 shadow-xs dark:border-input">
        <button
          type="button"
          onClick={onReset}
          title="Zoom out to every photo"
          className={CONTROL_BUTTON}
        >
          <Maximize aria-hidden />
          All photos
        </button>
      </div>
      <label className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-sm font-medium text-muted-foreground shadow-xs dark:border-input">
        <Navigation className="size-4" aria-hidden />
        <span className="sr-only">Jump to an area</span>
        <select
          // Always back on "Jump to", as it's an action rather than a setting.
          value=""
          onChange={(event) => {
            const area = MAP_AREAS.find((choice) => choice.name === event.target.value);
            if (area) showArea(area.bounds);
          }}
          className="h-full cursor-pointer bg-transparent text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      </label>
      {children}
    </div>
  );
}
