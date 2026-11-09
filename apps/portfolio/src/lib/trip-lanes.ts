import type { ExpressionSpecification } from "maplibre-gl";

/**
 * Where trip lines run over each other, such as walking a street one way and driving it back, each
 * later line gets the next free lane, which the map draws a few pixels to the side so both show.
 */

/** Any GeoJSON feature; only LineStrings get a lane. */
interface AnyFeature {
  geometry: { type: string; coordinates: unknown };
  properties: object;
}

/** The size of the grid lines are compared on, in degrees: about 30 m. */
const CELL = 0.0003;

/** How much of the shorter line has to run along the other for the two to overlap. */
const SHARED = 0.3;

/** How far apart lanes are drawn, in pixels. */
const LANE_PX = 6;

/** A line's lane: 0 for the first. */
const LANE: ExpressionSpecification = ["coalesce", ["get", "lane"], 0];

/** Zoomed out to here or further, lines are drawn on their own track, with no lane to the side. */
const LANES_FROM_ZOOM = 12;

/** Zoomed in to here or closer, lanes are drawn their full LANE_PX apart. */
const LANES_FULL_ZOOM = 15;

/**
 * The `line-offset` paint that draws a line in its lane: none for the first. The lanes close up
 * as the map zooms out, since a short line, such as the walk from a photo to a station, drawn
 * 6 px aside there looks cut off from the lines it joins.
 */
export const LANE_OFFSET: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  LANES_FROM_ZOOM,
  0,
  LANES_FULL_ZOOM,
  ["*", LANE, LANE_PX],
];

/** The lines drawn so far: which are near each grid cell, and each one's size and lane. */
interface Drawn {
  near: Map<string, number[]>;
  sizes: number[];
  lanes: number[];
}

/**
 * The features with a `lane` on each line that runs over an earlier one: the lowest lane none of
 * the lines it overlaps is in. Lines in lane 0, and anything that isn't a line, are unchanged.
 */
export function withLanes<F extends AnyFeature>(features: F[]): F[] {
  const drawn: Drawn = { near: new Map(), sizes: [], lanes: [] };
  return features.map((f) => {
    if (f.geometry.type !== "LineString") return f;
    const lane = drawLine(drawn, cellsOf(f.geometry.coordinates as number[][]));
    return lane === 0 ? f : { ...f, properties: { ...f.properties, lane } };
  });
}

/** Adds a line's cells to what's drawn, and gives back its lane. */
function drawLine(drawn: Drawn, cells: Set<string>): number {
  const lane = freeLane(overlapped(drawn, cells));
  const index = drawn.lanes.push(lane) - 1;
  drawn.sizes.push(cells.size);
  for (const cell of around(cells)) drawn.near.set(cell, [...(drawn.near.get(cell) ?? []), index]);
  return lane;
}

/** The lanes of the lines drawn so far that this one runs along. */
function overlapped(drawn: Drawn, cells: Set<string>): Set<number> {
  const lanes = new Set<number>();
  for (const [i, count] of sharedCells(drawn, cells)) {
    if (count >= needed(cells.size, drawn.sizes[i])) lanes.add(drawn.lanes[i] ?? 0);
  }
  return lanes;
}

/** How many of the line's cells each line drawn so far runs near, by its index. */
function sharedCells(drawn: Drawn, cells: Set<string>): Map<number, number> {
  const shared = new Map<number, number>();
  for (const cell of cells) addEach(shared, drawn.near.get(cell));
  return shared;
}

function addEach(counts: Map<number, number>, indexes: number[] = []) {
  for (const i of indexes) counts.set(i, (counts.get(i) ?? 0) + 1);
}

/** How many cells two lines of these sizes have to share to overlap: at least two. */
function needed(a: number, b = 0): number {
  return Math.max(2, SHARED * Math.min(a, b));
}

/** The lowest lane not taken. */
function freeLane(taken: Set<number>): number {
  let lane = 0;
  while (taken.has(lane)) lane += 1;
  return lane;
}

/** The grid cells a line passes through, filling in its long stretches between points. */
function cellsOf(coordinates: number[][]): Set<string> {
  const cells = new Set<string>();
  coordinates.forEach((to, i) => {
    for (const cell of stretch(coordinates[i - 1] ?? to, to)) cells.add(cell);
  });
  return cells;
}

/** The cells along the stretch from a to b, at most 200 of them for a long one such as a flight. */
function* stretch([lng0 = 0, lat0 = 0]: number[], [lng1 = 0, lat1 = 0]: number[]) {
  const steps = Math.min(200, Math.ceil(Math.hypot(lng1 - lng0, lat1 - lat0) / CELL));
  for (let s = 0; s <= steps; s += 1) {
    const t = steps === 0 ? 0 : s / steps;
    yield cellKey(lng0 + (lng1 - lng0) * t, lat0 + (lat1 - lat0) * t);
  }
}

function cellKey(lng: number, lat: number): string {
  return `${Math.round(lng / CELL)},${Math.round(lat / CELL)}`;
}

/** The cells and their eight neighbours, so lines a little apart, such as either side of a street, still meet. */
function around(cells: Set<string>): Set<string> {
  const near = new Set<string>();
  for (const cell of cells) {
    const [x = 0, y = 0] = cell.split(",").map(Number);
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) near.add(`${x + dx},${y + dy}`);
  }
  return near;
}
