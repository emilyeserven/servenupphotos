import type { LngLatBounds } from "maplibre-gl";
import { BrowseInViewButton } from "@/components/browse-in-view-button";
import { MapDayFilter } from "@/components/map-day-filter";
import { MapDisplayOptions } from "@/components/map-display-options";
import { MapLegend } from "@/components/map-legend";
import { MapViewControls } from "@/components/map-view-controls";
import { MapPlacePicker } from "@/components/map-place-picker";
import { PlaceAreaLayer } from "@/components/place-area-layer";
import { TripLinesLayer } from "@/components/trip-lines-layer";
import { MoreFilterControls } from "@/components/photo-filters";
import { ViewInGridButton } from "@/components/view-in-grid-button";
import type { MapDisplay } from "@/lib/map-display";
import { type DayRange, daysInView } from "@/lib/map-days";
import { gridFiltersFor } from "@/lib/map-grid-link";
import { type PlacedPhoto, placedPhotos } from "@/lib/map-photos";
import { parseFilters } from "@/lib/photo-filters";
import { useShownArea } from "@/lib/place-areas";

/**
 * The map's controls under its title: **Places**, which moves the map to a place and shades its
 * area while it's pointed at and once it's picked, when it has one (see place-areas.ts), the zoom-out button, the display options, then
 * **More filters** (the days in view, album, tag and genre), **View in grid** and **Browse**. The map's
 * key, in its bottom left corner, is drawn from here too, as it explains the shaded place area.
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
  onGoTo,
  browsable,
  onBrowse,
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
  /** Moves the map to show the photos, those of a place picked in **Places**. */
  onGoTo: (photos: PlacedPhoto[]) => void;
  /** The photos in view the photo viewer can step through, newest first. */
  browsable: PlacedPhoto[];
  onBrowse: (photo: PlacedPhoto, photos: PlacedPhoto[]) => void;
}) {
  const area = useShownArea();
  return (
    <MapViewControls
      onReset={onReset}
      places={
        <MapPlacePicker
          photos={filtered}
          onPick={(photos, value) => {
            area.pick(value);
            onGoTo(photos);
          }}
          onHover={area.hover}
        />
      }
    >
      <PlaceAreaLayer {...area.shown} />
      <TripLinesLayer photos={drawn} show={display.tripLines} flow={display.tripFlow} />
      <MapLegend photos={drawn} display={display} area={area.shown} />
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
        <BrowseInViewButton photos={browsable} onOpen={onBrowse} />
      </MoreFilterControls>
    </MapViewControls>
  );
}
