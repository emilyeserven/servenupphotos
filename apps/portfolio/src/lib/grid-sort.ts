import { startOfDay } from "date-fns";
import { type ColorOrder, type ColorSort, sortPhotos, type VividMeasure } from "@/lib/color-sort";
import type { ColorName } from "@/lib/photo-colors";
import type { Photo } from "@/lib/photos";
import { minuteOfDay } from "@/lib/time-of-day";

/**
 * What the Grid is sorted by: when each photo was taken, either way, when it was added to the
 * portfolio, most recent first, the time of day it was taken, earliest first, or its color or
 * vividness.
 */
export type GridSort = "newest" | "oldest" | "added" | "time" | ColorSort;

/** The Grid's sorts that aren't by color or vividness. */
type DateSort = Exclude<GridSort, ColorSort>;

/** How the Grid's color or vividness sort runs, from the URL with its defaults filled in. */
export interface GridColorSpec {
  order: ColorOrder;
  secondary?: ColorSort;
  secondaryOrder: ColorOrder;
  measure: VividMeasure;
  color?: ColorName;
}

/** A photo whose colors are saved, with how vivid they are, which is all the color sorts can place. */
type Colored<T extends Photo> = T & { vividness: number; peakVividness: number };

/** Whether a photo's colors are saved, with how vivid they are. */
function isColored<T extends Photo>(photo: T): photo is Colored<T> {
  return photo.palette.length > 0 && photo.vividness !== null && photo.peakVividness !== null;
}

/**
 * Which way each sort runs when the URL leaves `?order=` out: newest first and most recently added
 * first are descending, and the rest ascending. Oldest first is its own sort, ascending.
 */
export function defaultOrder(sort: GridSort): ColorOrder {
  return sort === "newest" || sort === "added" ? "desc" : "asc";
}

/** The date sorts that `?order=` can turn around; newest and oldest first are each other's way round. */
const ORDERED_DATE_SORTS: readonly GridSort[] = ["added", "time"];

/**
 * The `?order=` to keep for a date sort: only for Recently Added and Time of Day, and only when it's
 * the way round from their default.
 */
export function parseDateOrder(sort: GridSort, order: unknown): { order?: ColorOrder } {
  if (!ORDERED_DATE_SORTS.includes(sort)) return {};
  return order === "asc" || order === "desc" ? orderIfNotDefault(sort, order) : {};
}

/** `{ order }` unless it's the sort's default, which the URL leaves out. */
function orderIfNotDefault(sort: GridSort, order: ColorOrder): { order?: ColorOrder } {
  return order === defaultOrder(sort) ? {} : { order };
}

/**
 * The photos, given newest first, most recently added first (or least, ascending), photos added on
 * the same day by when they were taken, newest first, and photos that have no date added after the
 * rest, newest first.
 */
function byAdded<T extends Photo>(newestFirst: T[], order: ColorOrder): T[] {
  const added = newestFirst.filter((photo) => photo.addedAt !== null);
  const sorted = added.toSorted(
    (a, b) => addedDay(b) - addedDay(a) || b.takenAt.getTime() - a.takenAt.getTime(),
  );
  const ordered = order === "asc" ? sorted.toReversed() : sorted;
  return [...ordered, ...newestFirst.filter((photo) => photo.addedAt === null)];
}

/** The start of the day the photo was added, in milliseconds, or 0 when it has no date added. */
function addedDay(photo: Photo): number {
  return photo.addedAt ? startOfDay(photo.addedAt).getTime() : 0;
}

/**
 * The photos, given newest first, by the time of day they were taken, from just after midnight
 * to just before (or the other way round, descending), photos taken at the same minute newest first.
 */
function byTimeOfDay<T extends Photo>(newestFirst: T[], order: ColorOrder): T[] {
  const sign = order === "desc" ? -1 : 1;
  return newestFirst.toSorted((a, b) => sign * (minuteOfDay(a) - minuteOfDay(b)));
}

/** Each sort that isn't by color or vividness, given the photos newest first and which way it runs. */
const DATE_SORTS: Record<DateSort, <T extends Photo>(newestFirst: T[], order: ColorOrder) => T[]> =
  {
    newest: (newestFirst) => newestFirst,
    oldest: (newestFirst) => newestFirst.toReversed(),
    added: byAdded,
    time: byTimeOfDay,
  };

/** Whether the sort is by color or vividness. */
function isColorSort(sort: GridSort): sort is ColorSort {
  return !(sort in DATE_SORTS);
}

/**
 * The photos, given newest first, in the Grid's sort: newest or oldest first, by when they were
 * added or the time of day, either way as spec's order says, or by color or vividness as spec asks, with photos whose colors
 * aren't saved yet after the rest, newest first.
 */
export function sortGrid<T extends Photo>(
  newestFirst: T[],
  sort: GridSort,
  spec: GridColorSpec,
): T[] {
  if (!isColorSort(sort)) return DATE_SORTS[sort](newestFirst, spec.order);
  const colored = sortPhotos(newestFirst.filter(isColored), { ...spec, sort });
  return [...colored, ...newestFirst.filter((photo) => !isColored(photo))];
}
