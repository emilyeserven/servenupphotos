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
 * The photos, given newest first, most recently added first, photos added on the same day by when
 * they were taken, newest first, and photos that have no date added after the rest, newest first.
 */
function byAdded<T extends Photo>(newestFirst: T[]): T[] {
  const added = newestFirst.filter((photo) => photo.addedAt !== null);
  const sorted = added.toSorted(
    (a, b) => addedDay(b) - addedDay(a) || b.takenAt.getTime() - a.takenAt.getTime(),
  );
  return [...sorted, ...newestFirst.filter((photo) => photo.addedAt === null)];
}

/** The start of the day the photo was added, in milliseconds, or 0 when it has no date added. */
function addedDay(photo: Photo): number {
  return photo.addedAt ? startOfDay(photo.addedAt).getTime() : 0;
}

/**
 * The photos, given newest first, by the time of day they were taken, from just after midnight
 * to just before, photos taken at the same minute newest first.
 */
function byTimeOfDay<T extends Photo>(newestFirst: T[]): T[] {
  return newestFirst.toSorted((a, b) => minuteOfDay(a) - minuteOfDay(b));
}

/** Each sort that isn't by color or vividness, given the photos newest first. */
const DATE_SORTS: Record<DateSort, <T extends Photo>(newestFirst: T[]) => T[]> = {
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
 * The photos, given newest first, in the Grid's sort: newest or oldest first, most recently
 * added first, by time of day, or by color or vividness as spec asks, with photos whose colors
 * aren't saved yet after the rest, newest first.
 */
export function sortGrid<T extends Photo>(
  newestFirst: T[],
  sort: GridSort,
  spec: GridColorSpec,
): T[] {
  if (!isColorSort(sort)) return DATE_SORTS[sort](newestFirst);
  const colored = sortPhotos(newestFirst.filter(isColored), { ...spec, sort });
  return [...colored, ...newestFirst.filter((photo) => !isColored(photo))];
}
