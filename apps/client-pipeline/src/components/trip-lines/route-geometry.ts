import type { StationWalk, TripPoint, TripSegment } from "@/api/trip-lines";
import type { TripLegRide } from "@/api/trips";
import type { TripPhoto } from "@/lib/trip-days";
import { type LngLat, linePoints } from "@/lib/trip-points";
import { walkLine } from "@/lib/station-walks";

/** What the map draws a line by: its mode, and for a hop along its line, that line's color. */
interface LineProps {
  mode: string;
  /** Whether it's a hop drawn along the track of the line it rode. */
  onLine: boolean;
  colour: string;
  /** Whether it's outside the group shown on its own, so drawn faint. */
  faded: boolean;
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
function lineProps(segment: TripSegment, focus?: string): LineProps {
  const onLine = segment.line !== undefined && hasPath(segment);
  const faded = focus !== undefined && segment.name !== focus;
  return { mode: segment.mode, onLine, colour: colourOf(segment), faded };
}

/** Whether the segment has a path to draw along. */
function hasPath(segment: TripSegment): boolean {
  return (segment.path?.length ?? 0) >= 2;
}

/** The color of the line the segment rode, or else the usual hop color. */
function colourOf(segment: TripSegment): string {
  return segment.line?.colour || HOP_COLOUR;
}

/** The segments as GeoJSON lines with their mode, the way the map draws them; a wander draws none. */
export function lineFeatures(
  segments: TripSegment[],
  photos: TripPhoto[],
  focus?: string,
): LineCollection {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const drawn = segments.filter((segment) => segment.mode !== "wander");
  const features = drawn.flatMap((segment): LineFeature[] => {
    const coordinates = segmentCoordinates(segment, byId);
    if (coordinates.length < 2) return [];
    const props = lineProps(segment, focus);
    return [...rideLines(segment, props, coordinates), ...stationWalks(segment, byId, props.faded)];
  });
  return { type: "FeatureCollection", features };
}

/**
 * The hop along its track, or each line it rode in turn along its stretch, in that line's color,
 * when its route changed lines.
 */
function rideLines(segment: TripSegment, props: LineProps, coordinates: LngLat[]): LineFeature[] {
  const rides = props.onLine ? drawnRides(segment.rides) : [];
  if (rides.length === 0) return [feature(props, coordinates)];
  return rides.map((r) => feature({ ...props, colour: rideColour(r, props) }, r.path as LngLat[]));
}

/** The rides to draw apart: two or more, each with its track; none otherwise. */
function drawnRides(rides: TripLegRide[] = []): TripLegRide[] {
  const tracked = rides.filter((r) => (r.path?.length ?? 0) >= 2);
  return rides.length >= 2 && tracked.length === rides.length ? rides : [];
}

/** The ride's line's color, or else the hop's. */
function rideColour(ride: TripLegRide, props: LineProps): string {
  return ride.line?.colour || props.colour;
}

/** A GeoJSON line. */
function feature(properties: LineProps, coordinates: LngLat[]): LineFeature {
  return { type: "Feature", properties, geometry: { type: "LineString", coordinates } };
}

/** The walks from a hop's first point to the station it got on at, and from where it got off to its last. */
function stationWalks(
  segment: TripSegment,
  byId: Map<number, TripPhoto>,
  faded: boolean,
): LineFeature[] {
  if (!lineProps(segment).onLine) return [];
  const a = segment.start ?? byId.get(segment.photos[0]!);
  const b = segment.end ?? byId.get(segment.photos.at(-1)!);
  return [
    ...walkBetween(a, segment.board, segment.boardWalk, faded),
    ...walkBetween(segment.alight, b, segment.alightWalk, faded),
  ];
}

/** A short walk from x to y through its via spots or along its path, as a one-line list; none when either is missing. */
function walkBetween(
  x: TripPoint | TripPhoto | undefined,
  y: TripPoint | TripPhoto | undefined,
  shape: StationWalk | undefined,
  faded: boolean,
): LineFeature[] {
  if (!x || !y) return [];
  const walk = { mode: "walk", onLine: false, colour: HOP_COLOUR, faded };
  return [
    feature(
      walk,
      walkLine(shape, x, y).map((p) => [p.longitude, p.latitude] as LngLat),
    ),
  ];
}

/** The whole world, less the poles, for a map with nothing on it yet. */
const WORLD: [number, number, number, number] = [-170, -60, 170, 75];

/**
 * The corners around the points, as [west, south, east, north]; the whole world with none, such
 * as a day planned before its photos with no trip stops yet.
 */
export function pointsBounds(points: (TripPoint | TripPhoto)[]): [number, number, number, number] {
  if (points.length === 0) return WORLD;
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
