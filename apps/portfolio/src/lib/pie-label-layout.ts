/**
 * Where a pie's slice names go so they never overlap: each side's names in one column, spaced at least a line apart
 * and kept inside the box, with a line from each slice to its name. The lines keep the slices' order, so they never
 * cross either.
 */

/** A point in the pie's box, in pixels. */
type Point = readonly [x: number, y: number];

/** The pie's center, radius and box height, in pixels, as recharts draws it. */
export interface PieGeometry {
  cx: number;
  cy: number;
  radius: number;
  height: number;
}

/** Where one slice's name goes, and the line from the slice to it. */
export interface PieLabelPlace {
  /** The side of the pie the name is on; a right name starts at `x`, a left one ends there. */
  side: "left" | "right";
  /** Where the name's text is anchored, its middle at `y`. */
  x: number;
  y: number;
  /** The line from the slice's edge, out a little, then across to the name. */
  points: Point[];
}

/** The least room between two names' middles, in pixels: one line of small text. */
export const LABEL_LINE_HEIGHT = 16;

/** How far past the pie's edge each side's column of names starts, in pixels. */
const LABEL_GAP = 26;

/** How far straight out from the slice its line goes before it turns to the name, in pixels. */
const ELBOW = 8;

/** How far the name's text sits from the end of its line, in pixels. */
const TEXT_GAP = 4;

/**
 * The middle angle of each slice, in degrees counterclockwise from 3 o'clock, as recharts lays out a pie with its
 * defaults (start at 0°, all the way round, no padding or least angle).
 */
export function sliceMidAngles(values: number[]): number[] {
  const sum = values.reduce((total, value) => total + Math.max(value, 0), 0);
  let start = 0;
  return values.map((value) => {
    const angle = sum > 0 ? (Math.max(value, 0) / sum) * 360 : 0;
    const mid = start + angle / 2;
    start += angle;
    return mid;
  });
}

/** The point `distance` from the center at `angle` degrees, with y growing downward as on screen. */
function polar(geometry: PieGeometry, distance: number, angle: number): Point {
  const radians = (-angle * Math.PI) / 180;
  return [geometry.cx + distance * Math.cos(radians), geometry.cy + distance * Math.sin(radians)];
}

/**
 * The heights for names that want to sit at `wanted` (top to bottom), moved as little as can be so each is at
 * least a line below the one before and all stay between `top` and `bottom`. When they can't all fit a line
 * apart, they share the room evenly.
 */
export function spreadLabels(wanted: number[], top: number, bottom: number): number[] {
  const room = Math.max(bottom - top, 0);
  const gap = wanted.length > 1 ? Math.min(LABEL_LINE_HEIGHT, room / (wanted.length - 1)) : 0;
  const placed: number[] = [];
  for (const [i, y] of wanted.entries()) {
    placed.push(Math.max(y, top, i > 0 ? placed[i - 1]! + gap : top));
  }
  for (let i = placed.length - 1; i >= 0; i--) {
    placed[i] = Math.min(placed[i]!, bottom, i < placed.length - 1 ? placed[i + 1]! - gap : bottom);
  }
  return placed;
}

/** One slice that gets a name: its index, its middle angle, and where its line turns. */
interface Wanted {
  index: number;
  angle: number;
  elbow: Point;
}

/** The places for one side's names, spread so none overlap. */
function placeSide(side: PieLabelPlace["side"], slices: Wanted[], geometry: PieGeometry) {
  const sorted = slices.toSorted((a, b) => a.elbow[1] - b.elbow[1]);
  const half = LABEL_LINE_HEIGHT / 2;
  const ys = spreadLabels(
    sorted.map((slice) => slice.elbow[1]),
    half,
    geometry.height - half,
  );
  const sign = side === "right" ? 1 : -1;
  const column = geometry.cx + sign * (geometry.radius + LABEL_GAP);
  return sorted.map((slice, i) => {
    const y = ys[i]!;
    const edge = polar(geometry, geometry.radius, slice.angle);
    const place: PieLabelPlace = {
      side,
      x: column + sign * TEXT_GAP,
      y,
      points: [edge, slice.elbow, [column, y]],
    };
    return [slice.index, place] as const;
  });
}

/**
 * Where each slice's name goes around the pie, by the slice's index; none for a slice with no photos, which
 * isn't drawn. Names on each side stay in their slices' order, top to bottom.
 */
export function pieLabelPlaces(
  values: number[],
  geometry: PieGeometry,
): (PieLabelPlace | undefined)[] {
  const angles = sliceMidAngles(values);
  const sides: Record<PieLabelPlace["side"], Wanted[]> = { left: [], right: [] };
  for (const [index, angle] of angles.entries()) {
    if (!(values[index]! > 0)) continue;
    const elbow = polar(geometry, geometry.radius + ELBOW, angle);
    sides[elbow[0] >= geometry.cx ? "right" : "left"].push({ index, angle, elbow });
  }
  const places: (PieLabelPlace | undefined)[] = values.map(() => undefined);
  for (const side of ["left", "right"] as const) {
    for (const [index, place] of placeSide(side, sides[side], geometry)) places[index] = place;
  }
  return places;
}
