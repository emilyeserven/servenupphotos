import type { StatRow } from "@portfolio/lib/stat-groups";

/**
 * How much of each axis a graph shows, picked in the Adjust Graph box's Range group and set by
 * presets too. Every part is off at first.
 */
export interface GraphRanges {
  /** The first and last x values shown, by their names, in the axis's order, such as f/2 to f/8; null for the axis's own start or end. */
  xFrom: string | null;
  xTo: string | null;
  /** A scatterplot's first and last y values shown, like the x axis's. */
  yFrom: string | null;
  yTo: string | null;
  /** Where a bar, line or dot graph's y axis starts and ends, such as 0 to 50 photos; null for its own. */
  yMin: number | null;
  yMax: number | null;
  /** How many photos an x value needs to be shown, such as 5; 0 for any. */
  minPhotos: number;
  /** Whether the x values with no photos at either end of the axis are left out; ones in between stay. */
  hideZeros: boolean;
  /** How many of the x axis's values each bucket puts together, in the axis's own order, such as 2 for f/1.4 – f/2; 0 for none. */
  xBucket: number;
  /** A scatterplot's or heatmap's y values put together, like the x axis's. */
  yBucket: number;
  /** How wide each of the x axis's even ranges is, for a camera setting, in its steps, such as 1 stop or 25 mm; 0 for none. Set, it takes the place of `xBucket`. */
  xWidth: number;
  /** A scatterplot's or heatmap's y camera setting in even ranges, like the x axis's. */
  yWidth: number;
}

/** The ranges, all off. */
export const NO_RANGES: GraphRanges = {
  xFrom: null,
  xTo: null,
  yFrom: null,
  yTo: null,
  yMin: null,
  yMax: null,
  minPhotos: 0,
  hideZeros: false,
  xBucket: 0,
  yBucket: 0,
  xWidth: 0,
  yWidth: 0,
};

/** Where a named end is among the rows; the fallback when it's off or not among them. */
function endIndex(rows: StatRow[], label: string | null, fallback: number): number {
  const index = label === null ? -1 : rows.findIndex((row) => row.label === label);
  return index < 0 ? fallback : index;
}

/** The rows from one named row to another, both included, in their order; all of them when the ends are off. */
export function rowsBetween(rows: StatRow[], from: string | null, to: string | null): StatRow[] {
  const start = endIndex(rows, from, 0);
  const end = endIndex(rows, to, rows.length - 1);
  return rows.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** The rows without the ones with no photos at either end; ones in between stay, keeping the scale. */
function trimEmptyEnds(rows: StatRow[]): StatRow[] {
  const first = rows.findIndex((row) => row.count > 0);
  const last = rows.findLastIndex((row) => row.count > 0);
  return first < 0 ? [] : rows.slice(first, last + 1);
}

/** The x axis's rows the Range group keeps: from its first to last value, with enough photos, empty ends trimmed when asked. */
export function rangedRows(rows: StatRow[], ranges: GraphRanges): StatRow[] {
  const kept = rowsBetween(rows, ranges.xFrom, ranges.xTo).filter(
    (row) => row.count >= ranges.minPhotos,
  );
  return ranges.hideZeros ? trimEmptyEnds(kept) : kept;
}

/** Where a bar, line or dot graph's y axis runs; undefined for its own start and end. */
export type YDomain = [number, number | "auto"] | undefined;

/** The y axis's start and end the Range group sets, if it sets either. */
export function yDomain({ yMin, yMax }: GraphRanges): YDomain {
  if (yMin === null && yMax === null) return undefined;
  return [Number(yMin), yMax === null ? "auto" : yMax];
}

/** A step that splits up to `top` into about ten round parts: 1, 2 or 5 times a power of ten. */
function roundStep(top: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(top, 1) / 10));
  return [1, 2, 5, 10].map((n) => n * power).find((step) => top / step <= 10) ?? power * 10;
}

/** Round numbers from 0 up to just past `top`, such as 0, 20, 40 … 120 for 113: the y axis's choices. */
export function roundSteps(top: number): number[] {
  const step = roundStep(top);
  const count = Math.ceil(Math.max(top, 1) / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** The photo counts the x values have, lowest first and once each: the choices of how many an x value needs. */
export function photoCounts(rows: StatRow[]): number[] {
  return [...new Set(rows.map((row) => row.count))].toSorted((a, b) => a - b);
}
