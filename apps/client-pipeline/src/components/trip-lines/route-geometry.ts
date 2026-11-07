import type { TripPoint, TripSegment } from "@/api/trip-lines";
import type { TripPhoto } from "@/lib/trip-days";
import { type LngLat, linePoints } from "@/lib/trip-points";

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

/** The points the segment's line goes through: its path along streets when it has one, or else its points. */
function segmentCoordinates(segment: TripSegment, byId: Map<number, TripPhoto>): LngLat[] {
  if (segment.path && segment.path.length >= 2) return segment.path;
  return linePoints(segment, byId).map((p) => p.at);
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
