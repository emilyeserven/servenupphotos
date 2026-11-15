import { LngLatBounds } from "maplibre-gl";
import { useMemo } from "react";
import { type PlacedSet, splitSets } from "@/lib/map-sets";
import { filterPhotos, type PhotoFilters } from "@/lib/photo-filters";
import { filterByVisuals, type VisualSearch } from "@/lib/visual-filters";
import { photos, type Photo } from "@/lib/photos";
import { photoSets } from "@/lib/photo-sets";

/** A photo with a GPS position, which is all the map can show. */
export type PlacedPhoto = Photo & { latitude: number; longitude: number };

/** Where a photo is on the map, as GeoJSON. */
export interface PhotoPoint {
  type: "Point";
  coordinates: [number, number];
}

/** Every photo with a GPS position, before the filters. */
export const placedPhotos = photos.filter(
  (photo): photo is PlacedPhoto => photo.latitude !== null && photo.longitude !== null,
);

/**
 * Every photo with a GPS position by its ID. The map's source only has the photos the filters
 * leave, so looking its points up here finds only those.
 */
export const placedById = new Map(placedPhotos.map((photo) => [photo.id, photo]));

/** The bounds of every photo, or null without any. */
export function boundsOf(points: PlacedPhoto[]): LngLatBounds | null {
  if (points.length === 0) return null;
  const bounds = new LngLatBounds();
  for (const photo of points) bounds.extend([photo.longitude, photo.latitude]);
  return bounds;
}

/** The photos as the map's GeoJSON source, each point carrying its photo's ID. */
function geoJsonOf(points: PlacedPhoto[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((photo) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point",
        coordinates: [photo.longitude, photo.latitude],
      } satisfies PhotoPoint,
      properties: { id: photo.id },
    })),
  };
}

/** A Photo Set the map draws as one marker. */
export type MapSet = PlacedSet<PlacedPhoto>;

/** The photos the map shows, its Photo Sets, their GeoJSON and their bounds. */
interface MapPhotos {
  placed: PlacedPhoto[];
  /** The Photo Sets with at least two photos the filters leave, each always one marker. */
  sets: MapSet[];
  /** The photos not in those sets, which MapLibre groups. */
  geoJson: ReturnType<typeof geoJsonOf>;
  bounds: LngLatBounds | null;
}

/**
 * The photos with a GPS position the filters leave, worked out again only when the filters
 * change, so the map's source isn't reset on every render.
 */
export function useMapPhotos(filters: PhotoFilters & VisualSearch): MapPhotos {
  const key = JSON.stringify(filters);
  return useMemo(() => {
    const parsed = JSON.parse(key) as PhotoFilters & VisualSearch;
    const placed = filterByVisuals(filterPhotos(placedPhotos, parsed), parsed);
    // A set's photos stay out of the grouped source, so MapLibre never splits them apart or groups
    // them with the photos around them.
    const { sets, loose } = splitSets(placed, photoSets);
    return {
      placed,
      sets,
      geoJson: geoJsonOf(loose),
      bounds: boundsOf(placed),
    };
  }, [key]);
}
