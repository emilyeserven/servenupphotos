import { LngLatBounds } from "maplibre-gl";
import { useMemo } from "react";
import { filterPhotos, type PhotoFilters } from "@/lib/photo-filters";
import { photos, type Photo } from "@/lib/photos";

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

/** The photos the map shows, their GeoJSON and their bounds. */
interface MapPhotos {
  placed: PlacedPhoto[];
  geoJson: ReturnType<typeof geoJsonOf>;
  bounds: LngLatBounds | null;
}

/**
 * The photos with a GPS position the filters leave, worked out again only when the filters
 * change, so the map's source isn't reset on every render.
 */
export function useMapPhotos(filters: PhotoFilters): MapPhotos {
  const key = JSON.stringify(filters);
  return useMemo(() => {
    const placed = filterPhotos(placedPhotos, JSON.parse(key) as PhotoFilters);
    return {
      placed,
      geoJson: geoJsonOf(placed),
      bounds: boundsOf(placed),
    };
  }, [key]);
}
