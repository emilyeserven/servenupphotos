import type { TripPoint, TripSegment } from "@/api/trip-lines";
import type { TripPhoto } from "@/lib/trip-days";

type LngLat = [number, number];

/** A segment as a GeoJSON line, with its mode. */
interface LineFeature {
  type: "Feature";
  properties: { mode: string };
  geometry: { type: "LineString"; coordinates: LngLat[] };
}

/** The lines of a day, as a GeoJSON source takes them. */
interface LineCollection {
  type: "FeatureCollection";
  features: LineFeature[];
}

/** The point as [longitude, latitude], as GeoJSON writes it. */
function lngLat(p: TripPoint | TripPhoto): LngLat {
  return [p.longitude, p.latitude];
}

/** The points the segment's line goes through: its start, its photos that are on the day, its end. */
function segmentCoordinates(segment: TripSegment, byId: Map<number, TripPhoto>): LngLat[] {
  const photos = segment.photos.flatMap((id) => byId.get(id) ?? []);
  const points = [segment.start, ...photos, segment.end].filter((p) => p !== undefined);
  return points.map(lngLat);
}

/** The segments as GeoJSON lines with their mode, the way the map draws them. */
export function lineFeatures(segments: TripSegment[], photos: TripPhoto[]): LineCollection {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const features = segments.flatMap((segment): LineFeature[] => {
    const coordinates = segmentCoordinates(segment, byId);
    if (coordinates.length < 2) return [];
    return [
      {
        type: "Feature",
        properties: { mode: segment.mode },
        geometry: { type: "LineString", coordinates },
      },
    ];
  });
  return { type: "FeatureCollection", features };
}

/** The corners around the points, as [west, south, east, north]. */
export function pointsBounds(points: (TripPoint | TripPhoto)[]): [number, number, number, number] {
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
