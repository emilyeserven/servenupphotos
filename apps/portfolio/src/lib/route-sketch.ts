import type { GeoBounds } from "@portfolio/lib/fit-view";
import { withLanes } from "@portfolio/lib/trip-lanes";

/**
 * A feature a sketch draws, as TRIPLINES.geo.json has them or the pipeline's Trips tab builds them
 * from each day's line: a LineString with its `mode`, or a place visited as a Point.
 */
export interface SketchFeature {
  geometry: { type: string; coordinates: unknown };
  properties: {
    feature?: string;
    mode?: string;
    colour?: string;
    /** The Trip a leg between days is part of; a sketch leaves legs out. */
    trip?: string;
    lane?: number;
  };
}

/**
 * The size of a route sketch in pixels, and how far apart it draws the lanes of lines that run
 * over an earlier one, as the Map does a few pixels to the side.
 */
export interface SketchSize {
  width: number;
  height: number;
  lane: number;
}

/** The size of a day's route sketch on the Timeline, in its heading. */
export const SKETCH_SIZE: SketchSize = { width: 48, height: 32, lane: 1.5 };

/** The size of each of a month's small trip line maps on the Timeline, a place's days together. */
export const MONTH_SKETCH_SIZE: SketchSize = { width: 144, height: 96, lane: 2.5 };

/** How far the sketch keeps from its edges, so round line caps and dots aren't cut off. */
const PAD = 3;

type LngLat = [number, number];

/** A point placed in the sketch. */
interface Point {
  x: number;
  y: number;
}

/** One trip line drawn in a sketch: its points as an SVG `points` list, its mode and its line's color. */
export interface SketchLine {
  points: string;
  mode?: string;
  colour?: string;
}

/** A day's route fitted into the sketch: its lines and the places visited as dots. */
export interface RouteSketch {
  lines: SketchLine[];
  visits: { x: number; y: number }[];
  /** The box on the map around the whole route, for the Map to open fitted to it. */
  bounds: GeoBounds;
}

/** A day's own line; a Trip's leg to another day, such as a flight, would dwarf the day's route. */
function isLine(feature: SketchFeature): boolean {
  return feature.geometry.type === "LineString" && feature.properties.trip === undefined;
}

function isVisit(feature: SketchFeature): boolean {
  return feature.properties.feature === "visit";
}

function lineCoordinates(feature: SketchFeature): LngLat[] {
  return feature.geometry.coordinates as LngLat[];
}

function visitCoordinates(feature: SketchFeature): LngLat {
  return feature.geometry.coordinates as LngLat;
}

/**
 * Turns longitude and latitude into flat x and y, squeezing longitude by the cosine of the
 * latitude so the shape isn't stretched sideways away from the equator, like the map draws it.
 */
function flatten(points: LngLat[]): LngLat[] {
  const meanLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const squeeze = Math.cos((meanLat * Math.PI) / 180);
  return points.map(([lng, lat]) => [lng * squeeze, -lat]);
}

/** The box around the points: its smallest x and y and its size. */
function boxOf(points: LngLat[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** A function that places a flattened point in the sketch, scaled to fit and centered. */
function fitter(points: LngLat[], size: SketchSize) {
  const box = boxOf(points);
  const room = { width: size.width - 2 * PAD, height: size.height - 2 * PAD };
  const scale = Math.min(room.width / box.width || Infinity, room.height / box.height || Infinity);
  const k = Number.isFinite(scale) ? scale : 0;
  const left = (size.width - box.width * k) / 2;
  const top = (size.height - box.height * k) / 2;
  return ([x, y]: LngLat): Point => ({ x: left + (x - box.minX) * k, y: top + (y - box.minY) * k });
}

/** The direction to the right of the line at one of its points, where the Map draws a later lane. */
function rightOf(at: Point, i: number, points: Point[]): Point {
  const from = points[i - 1] ?? at;
  const to = points[i + 1] ?? at;
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
}

/** The line moved `by` pixels to its right, for a line drawn in a lane beside an earlier one. */
function offsetLine(points: Point[], by: number): Point[] {
  if (by === 0) return points;
  return points.map((at, i) => {
    const right = rightOf(at, i, points);
    return { x: at.x + right.x * by, y: at.y + right.y * by };
  });
}

/** A line's points as an SVG `points` list. */
function pointsList(points: Point[]): string {
  return points.map(({ x, y }) => `${round(x)},${round(y)}`).join(" ");
}

/** The box on the map around the points. */
function geoBounds(points: LngLat[]): GeoBounds {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return {
    west: Math.min(...lngs),
    east: Math.max(...lngs),
    south: Math.min(...lats),
    north: Math.max(...lats),
  };
}

/** A number with at most one decimal, to keep the SVG small. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Trip lines and places visited from TRIPLINES.geo.json, such as a day's or a month's, fitted into
 * a box of `size` keeping their shape, each line that runs over an earlier one drawn to its side as
 * on the Map; null when there's no line to draw. Areas are left out.
 */
export function routeSketch(
  features: SketchFeature[],
  size: SketchSize = SKETCH_SIZE,
): RouteSketch | null {
  const lines = withLanes(features.filter(isLine));
  if (lines.length === 0) return null;
  const visits = features.filter(isVisit);
  const raw = [...lines.flatMap(lineCoordinates), ...visits.map(visitCoordinates)];
  const flat = flatten(raw);
  const placed = flat.map(fitter(flat, size));
  let next = 0;
  const take = (count: number) => placed.slice(next, (next += count));
  return {
    lines: lines.map((line) => ({
      points: pointsList(
        offsetLine(take(lineCoordinates(line).length), (line.properties.lane ?? 0) * size.lane),
      ),
      mode: line.properties.mode,
      colour: line.properties.colour,
    })),
    visits: take(visits.length),
    bounds: geoBounds(raw),
  };
}
