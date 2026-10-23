import { useMap } from "@vis.gl/react-maplibre";
import { Maximize } from "lucide-react";
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
 * A row of buttons over the map: one to go back to the view that shows every photo, and one for
 * each area in MAP_AREAS to zoom straight to it.
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
      <div
        role="group"
        aria-label="Go to an area"
        className="inline-flex rounded-md border bg-background p-0.5 shadow-xs dark:border-input"
      >
        {MAP_AREAS.map((area) => (
          <button
            key={area.name}
            type="button"
            onClick={() => showArea(area.bounds)}
            className={CONTROL_BUTTON}
          >
            {area.name}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
