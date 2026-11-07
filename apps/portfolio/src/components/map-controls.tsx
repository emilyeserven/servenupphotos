import type { LngLatBounds } from "maplibre-gl";
import { BrowseInViewButton } from "@/components/browse-in-view-button";
import { MapDisplayOptions } from "@/components/map-display-options";
import { MapLegend } from "@/components/map-legend";
import { MapViewControls } from "@/components/map-view-controls";
import { MapPlacePicker } from "@/components/map-place-picker";
import { PlaceAreaLayer } from "@/components/place-area-layer";
import { TripLinesLayer } from "@/components/trip-lines-layer";
import { MoreFilterControls } from "@/components/photo-filters";
import { ViewInGridButton } from "@/components/view-in-grid-button";
import type { MapDisplay } from "@/lib/map-display";
import { gridFiltersFor } from "@/lib/map-grid-link";
import { type PlacedPhoto, placedPhotos } from "@/lib/map-photos";
import { visualsOwnFilters } from "@/components/visuals-picker";
import { filterPhotos, parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { parseVisualFilters, type VisualSearch } from "@/lib/visual-filters";
import { useShownArea } from "@/lib/place-areas";

/**
 * The map's controls under its title: **Places**, which moves the map to a place and shades its
 * area while it's pointed at and once it's picked, when it has one (see place-areas.ts), the zoom-out button, the display options, then
 * **More filters** (Groups, When and Visuals), **View in grid** and **Browse**. The map's
 * key, in its bottom left corner, is drawn from here too, as it explains the shaded place area.
 */
export function MapControls({
  search,
  drawn,
  view,
  display,
  onDisplayChange,
  onReset,
  onGoTo,
  browsable,
  onBrowse,
}: {
  /** The map's URL search, with its filters. */
  search: Record<string, unknown>;
  /** The photos the filters leave, which the map draws. */
  drawn: PlacedPhoto[];
  /** What the map shows, or null before it's drawn. */
  view: LngLatBounds | null;
  display: MapDisplay;
  onDisplayChange: (change: Partial<MapDisplay>) => void;
  onReset: () => void;
  /** Moves the map to show the photos, those of a place picked in **Places**. */
  onGoTo: (photos: PlacedPhoto[]) => void;
  /** The photos in view the photo viewer can step through, newest first. */
  browsable: PlacedPhoto[];
  onBrowse: (photo: PlacedPhoto, photos: PlacedPhoto[]) => void;
}) {
  const area = useShownArea();
  const filters = parseFilters(search);
  const visuals = parseVisualFilters(search);
  return (
    <MapViewControls
      onReset={onReset}
      places={
        <MapPlacePicker
          photos={drawn}
          onPick={(photos, value) => {
            area.pick(value);
            onGoTo(photos);
          }}
          onHover={area.hover}
        />
      }
    >
      <PlaceAreaLayer {...area.shown} />
      <TripLinesLayer photos={drawn} show={display.tripLines} />
      <MapLegend photos={drawn} display={display} area={area.shown} />
      <MapDisplayOptions display={display} onChange={onDisplayChange} />
      <MoreFilterControls
        photos={placedPhotos}
        own={visualsOwnFilters(filterPhotos(placedPhotos, filters), visuals)}
      >
        <ViewInGridButton filters={gridLink(gridFiltersFor(drawn, view, filters), visuals)} />
        <BrowseInViewButton photos={browsable} onOpen={onBrowse} />
      </MoreFilterControls>
    </MapViewControls>
  );
}

/** The Grid's filters for the photos in view, with Visuals' filters too; null with none in view. */
function gridLink(filters: PhotoFilters | null, visuals: VisualSearch): PhotoFilters | null {
  return filters && { ...filters, ...visuals };
}
