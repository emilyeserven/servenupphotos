import { type ColorOrder, type ColorSort, sortPhotos, type VividMeasure } from "@/lib/color-sort";
import type { ColorName } from "@/lib/photo-colors";
import type { Photo } from "@/lib/photos";

/** What the Grid is sorted by: when each photo was taken, either way, or its color or vividness. */
export type GridSort = "newest" | "oldest" | ColorSort;

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
 * The photos, given newest first, in the Grid's sort: newest or oldest first, or by color or
 * vividness as spec asks, with photos whose colors aren't saved yet after the rest, newest first.
 */
export function sortGrid<T extends Photo>(
  newestFirst: T[],
  sort: GridSort,
  spec: GridColorSpec,
): T[] {
  if (sort === "newest") return newestFirst;
  if (sort === "oldest") return newestFirst.toReversed();
  const colored = sortPhotos(newestFirst.filter(isColored), { ...spec, sort });
  return [...colored, ...newestFirst.filter((photo) => !isColored(photo))];
}
