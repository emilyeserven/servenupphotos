import type { TripMapFeature } from "@/lib/trip-lines-map";

/** The width and height of a day's route sketch on the Timeline, in pixels. */
export const SKETCH_SIZE = { width: 48, height: 32 } as const;

/** How far the sketch keeps from its edges, so round line caps and dots aren't cut off. */
const PAD = 3;

type LngLat = [number, number];

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
}

/** A day's own line; a Trip's leg to another day, such as a flight, would dwarf the day's route. */
function isLine(feature: TripMapFeature): boolean {
  return feature.geometry.type === "LineString" && feature.properties.trip === undefined;
}

function isVisit(feature: TripMapFeature): boolean {
  return feature.properties.feature === "visit";
}

function lineCoordinates(feature: TripMapFeature): LngLat[] {
  return feature.geometry.coordinates as LngLat[];
}

function visitCoordinates(feature: TripMapFeature): LngLat {
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
function fitter(points: LngLat[]) {
  const box = boxOf(points);
  const room = { width: SKETCH_SIZE.width - 2 * PAD, height: SKETCH_SIZE.height - 2 * PAD };
  const scale = Math.min(room.width / box.width || Infinity, room.height / box.height || Infinity);
  const k = Number.isFinite(scale) ? scale : 0;
  const left = (SKETCH_SIZE.width - box.width * k) / 2;
  const top = (SKETCH_SIZE.height - box.height * k) / 2;
  return ([x, y]: LngLat) => ({ x: left + (x - box.minX) * k, y: top + (y - box.minY) * k });
}

/** A number with at most one decimal, to keep the SVG small. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * A day's trip lines and places visited from TRIPLINES.geo.json, fitted into a SKETCH_SIZE box
 * keeping their shape; null when the day has no line to draw. Areas are left out.
 */
export function routeSketch(features: TripMapFeature[]): RouteSketch | null {
  const lines = features.filter(isLine);
  if (lines.length === 0) return null;
  const visits = features.filter(isVisit);
  const raw = [...lines.flatMap(lineCoordinates), ...visits.map(visitCoordinates)];
  const flat = flatten(raw);
  const place = fitter(flat);
  const placed = flat.map(place);
  let next = 0;
  const take = (count: number) => placed.slice(next, (next += count));
  return {
    lines: lines.map((line) => ({
      points: take(lineCoordinates(line).length)
        .map(({ x, y }) => `${round(x)},${round(y)}`)
        .join(" "),
      mode: line.properties.mode,
      colour: line.properties.colour,
    })),
    visits: take(visits.length),
  };
}
