import {
  axisStatRows,
  type GraphConfig,
  rowPhotos,
  seriesColor,
  SPLIT_TYPES,
  statById,
} from "@/lib/graph-data";
import { bucketNames } from "@/lib/graph-buckets";
import type { Photo } from "@/lib/photos";
import type { StatRow } from "@/lib/stat-groups";

/**
 * A value picked on the Graph page by clicking it: a bar, a line's point, a slice or a scatterplot
 * dot, whose photos then show under the graph.
 */
export interface GraphPick {
  /** The x value, or the slice's. */
  x: string;
  /** A scatterplot dot's y value. */
  y?: string;
  /** For a pie's Other slice, the x values it puts together. */
  others?: string[];
}

/** One group of the picked photos, such as the Autumn part of a stacked bar. */
export interface PickedGroup {
  key: string;
  label: string;
  color: string;
  photos: Photo[];
}

/** The picked value's photos, in groups when the graph splits them. */
export interface PickedPhotos {
  /** What the groups are values of, such as "Season"; null when the photos aren't grouped. */
  groupedBy: string | null;
  groups: PickedGroup[];
  /** How many photos are picked, each counted once. */
  total: number;
}

/** The photos in any of the rows, in the list's order and each once. */
function photosIn(list: Photo[], rows: StatRow[]): Photo[] {
  const inside = new Set(rows.flatMap((row) => rowPhotos(list, row)));
  return list.filter((photo) => inside.has(photo));
}

/** The x axis's rows the pick is on: its own, or each one in a pie's Other slice. */
function pickedRows(list: Photo[], config: GraphConfig, pick: GraphPick): StatRow[] {
  const labels = new Set(pick.others ?? [pick.x]);
  return axisStatRows(list, config.x, config.xBucket).filter((row) => labels.has(row.label));
}

/** How many split values get their own color on the graph; the rest are drawn as Other. */
const MAX_SERIES = 8;

/** Each split value's color as the graph draws it, by its label: Other's gray for those past the colors. */
function splitColors(list: Photo[], split: string): (label: string) => string {
  const labels = statById(split)
    .build(list)
    .rows.map((row) => row.label);
  const own = labels.length > MAX_SERIES ? MAX_SERIES - 1 : labels.length;
  return (label) => {
    const index = labels.indexOf(label);
    return seriesColor(index >= 0 && index < own ? index : MAX_SERIES);
  };
}

/** Groups of the photos, one for each row with any. */
function groupsOf(list: Photo[], rows: StatRow[], color: (label: string) => string): PickedGroup[] {
  const groups = rows.map((row) => ({
    key: row.label,
    label: row.label,
    color: color(row.label),
    photos: rowPhotos(list, row),
  }));
  return groups.filter((group) => group.photos.length > 0);
}

/** One group of all the photos, for a pick that isn't split. */
function wholeGroup(label: string, list: Photo[]): PickedPhotos {
  return {
    groupedBy: null,
    groups: [{ key: label, label, color: seriesColor(0), photos: list }],
    total: list.length,
  };
}

/** The picked photos grouped by a stat, with each group colored. */
function groupedBy(inside: Photo[], stat: string, color: (label: string) => string): PickedPhotos {
  const groups = groupsOf(inside, statById(stat).build(inside).rows, color);
  return { groupedBy: statById(stat).label, groups, total: inside.length };
}

/**
 * A scatterplot dot's or heatmap cell's photos: the x value's ones that have the y value too, or
 * any of the values in the y bucket, which `list` (every photo kept) says.
 */
function scatterPhotos(
  list: Photo[],
  inside: Photo[],
  config: GraphConfig,
  y: string,
): PickedPhotos {
  const yBucket = bucketNames(statById(config.y).build(list).rows, config.yBucket);
  const rows = statById(config.y)
    .build(inside)
    .rows.filter((row) => yBucket(row.label) === y);
  return wholeGroup(y, photosIn(inside, rows));
}

/** Whether the graph splits each value by another stat. */
export function isSplit(config: GraphConfig): boolean {
  return config.split !== "" && SPLIT_TYPES.has(config.type);
}

/**
 * The photos of the picked value among the photos the filters keep: a pie's Other slice grouped by
 * its x values, a split graph's value grouped by the split, a scatterplot dot's photos, or else the
 * x value's photos in one group.
 */
export function pickedPhotos(list: Photo[], config: GraphConfig, pick: GraphPick): PickedPhotos {
  const inside = photosIn(list, pickedRows(list, config, pick));
  if (pick.others) return groupedBy(inside, config.x, () => seriesColor(MAX_SERIES));
  if (pick.y !== undefined) return scatterPhotos(list, inside, config, pick.y);
  if (isSplit(config)) return groupedBy(inside, config.split, splitColors(list, config.split));
  return wholeGroup(pick.x, inside);
}

/** What the picked groups are ordered by: their values in the axis's order, or how many photos they have. */
export type PickOrder = "axis" | "photos";

/** Which way the picked groups and photos go. */
export type Direction = "asc" | "desc";

/** Whether every group's label is a plain number, such as a year. */
function allNumbers(groups: PickedGroup[]): boolean {
  return groups.every((group) => /^-?\d+(\.\d+)?$/.test(group.label));
}

/** The groups in the axis's order, lowest first: by number when they're all numbers, or else as the Numbers card lists them. */
function byAxis(groups: PickedGroup[]): PickedGroup[] {
  if (!allNumbers(groups)) return groups;
  return groups.toSorted((a, b) => Number(a.label) - Number(b.label));
}

/** How each order puts the groups lowest first. */
const ASCENDING: Record<PickOrder, (groups: PickedGroup[]) => PickedGroup[]> = {
  axis: byAxis,
  photos: (groups) => groups.toSorted((a, b) => a.photos.length - b.photos.length),
};

/** The photos by when they were taken, oldest first, or newest first when descending. */
function byDate(photos: Photo[], direction: Direction): Photo[] {
  const sorted = photos.toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  return direction === "asc" ? sorted : sorted.toReversed();
}

/**
 * The groups in the order picked, ascending or descending, each one's photos by when they were
 * taken in the same direction.
 */
export function orderedGroups(
  groups: PickedGroup[],
  order: PickOrder,
  direction: Direction,
): PickedGroup[] {
  const ascending = ASCENDING[order](groups);
  const ordered = direction === "asc" ? ascending : ascending.toReversed();
  return ordered.map((group) => ({ ...group, photos: byDate(group.photos, direction) }));
}

/** Whether two picks are the same value. */
export function samePick(a: GraphPick | null, b: GraphPick): boolean {
  return a !== null && a.x === b.x && a.y === b.y;
}
