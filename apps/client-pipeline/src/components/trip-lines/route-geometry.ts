import type { TripPoint, TripSegment } from "@/api/trip-lines";
import type { TripPhoto } from "@/lib/trip-days";
import { type LngLat, linePoints } from "@/lib/trip-points";

/** What the map draws a line by: its mode, and for a hop along its line, that line's color. */
interface LineProps {
  mode: string;
  /** Whether it's a hop drawn along the track of the line it rode. */
  onLine: boolean;
  colour: string;
}

/** A segment as a GeoJSON line, with its mode. */
interface LineFeature {
  type: "Feature";
  properties: LineProps;
  geometry: { type: "LineString"; coordinates: LngLat[] };
}

/** The lines of a day, as a GeoJSON source takes them. */
interface LineCollection {
  type: "FeatureCollection";
  features: LineFeature[];
}

/** The points the segment's line goes through: its path along streets when it has one, or else its points. */
function segmentCoordinates(segment: TripSegment, byId: Map<number, TripPhoto>): LngLat[] {
  if (hasPath(segment)) return segment.path!;
  return linePoints(segment, byId).map((p) => p.at);
}

/** The hop color when a line has none of its own. */
const HOP_COLOUR = "#9333ea";

/** What the map draws the segment by. */
function lineProps(segment: TripSegment): LineProps {
  const onLine = segment.line !== undefined && hasPath(segment);
  return { mode: segment.mode, onLine, colour: colourOf(segment) };
}

/** Whether the segment has a path to draw along. */
function hasPath(segment: TripSegment): boolean {
  return (segment.path?.length ?? 0) >= 2;
}

/** The color of the line the segment rode, or else the usual hop color. */
function colourOf(segment: TripSegment): string {
  return segment.line?.colour || HOP_COLOUR;
}

/** The segments as GeoJSON lines with their mode, the way the map draws them. */
export function lineFeatures(segments: TripSegment[], photos: TripPhoto[]): LineCollection {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const features = segments.flatMap((segment): LineFeature[] => {
    const coordinates = segmentCoordinates(segment, byId);
    if (coordinates.length < 2) return [];
    return [feature(lineProps(segment), coordinates), ...stationWalks(segment, byId)];
  });
  return { type: "FeatureCollection", features };
}

/** A GeoJSON line. */
function feature(properties: LineProps, coordinates: LngLat[]): LineFeature {
  return { type: "Feature", properties, geometry: { type: "LineString", coordinates } };
}

/** The walks from a hop's first photo to the station it got on at, and from where it got off. */
function stationWalks(segment: TripSegment, byId: Map<number, TripPhoto>): LineFeature[] {
  if (!lineProps(segment).onLine) return [];
  const [a, b] = segment.photos.map((id) => byId.get(id));
  return [...walkBetween(a, segment.board), ...walkBetween(segment.alight, b)];
}

/** A short walk from x to y, as a one-line list; none when either is missing. */
function walkBetween(x?: TripPoint | TripPhoto, y?: TripPoint | TripPhoto): LineFeature[] {
  if (!x || !y) return [];
  const walk = { mode: "walk", onLine: false, colour: HOP_COLOUR };
  return [
    feature(
      walk,
      [x, y].map((p) => [p.longitude, p.latitude] as LngLat),
    ),
  ];
}

/** The corners around the points, as [west, south, east, north]. */
export function pointsBounds(points: (TripPoint | TripPhoto)[]): [number, number, number, number] {
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
