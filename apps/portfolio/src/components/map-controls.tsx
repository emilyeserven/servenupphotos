import type { LngLatBounds } from "maplibre-gl";
import { MapDayFilter } from "@/components/map-day-filter";
import { MapDisplayOptions } from "@/components/map-display-options";
import { MapViewControls } from "@/components/map-view-controls";
import { MapPlacesFilter, MoreFilterControls } from "@/components/photo-filters";
import { ViewInGridButton } from "@/components/view-in-grid-button";
import type { MapDisplay } from "@/lib/map-display";
import { type DayRange, daysInView } from "@/lib/map-days";
import { gridFiltersFor } from "@/lib/map-grid-link";
import { type PlacedPhoto, placedPhotos } from "@/lib/map-photos";
import { parseFilters } from "@/lib/photo-filters";

/**
 * The map's controls under its title: **Places**, the zoom-out button, the display options, then
 * **More filters** (the days in view, album, tag and genre) and **View in grid**.
 */
export function MapControls({
  search,
  filtered,
  drawn,
  view,
  display,
  onDisplayChange,
  onDaysChange,
  onReset,
}: {
  /** The map's URL search, with its filters and days. */
  search: Record<string, unknown> & DayRange;
  /** The photos the shared filters leave, whose days in view the day filter lists. */
  filtered: PlacedPhoto[];
  /** The photos the map draws, once the day filter is applied too. */
  drawn: PlacedPhoto[];
  /** What the map shows, or null before it's drawn. */
  view: LngLatBounds | null;
  display: MapDisplay;
  onDisplayChange: (change: Partial<MapDisplay>) => void;
  onDaysChange: (range: DayRange) => void;
  onReset: () => void;
}) {
  return (
    <MapViewControls onReset={onReset} places={<MapPlacesFilter photos={placedPhotos} />}>
      <MapDisplayOptions display={display} onChange={onDisplayChange} />
      <MoreFilterControls
        photos={placedPhotos}
        own={{
          count: search.day ? 1 : 0,
          children: (
            <MapDayFilter
              days={daysInView(filtered, view)}
              range={search}
              onChange={onDaysChange}
            />
          ),
        }}
      >
        <ViewInGridButton filters={gridFiltersFor(drawn, view, parseFilters(search))} />
      </MoreFilterControls>
    </MapViewControls>
  );
}
