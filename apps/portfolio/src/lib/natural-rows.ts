/** A photo the Grid's natural rows can place: all they need is its shape. */
interface Shaped {
  image: { width: number; height: number };
}

/** A row of natural tiles, all the same height. */
export interface NaturalRow<T> {
  photos: T[];
  /** How tall its tiles are at least, in pixels, before growing to fill the row. */
  height: number;
  /** Whether it's full, so its tiles grow to fill its width; the last rows are left as they are. */
  full: boolean;
}

/** The gap between tiles, in pixels, matching the list's `gap-3`. */
const GAP_PX = 12;

/** How tall a row of wide (or square) photos is at least. */
const WIDE_HEIGHT = 250;

/** How tall a row of vertical photos is at least: taller, since they're narrow. */
const TALL_HEIGHT = 400;

/** The width over height below which a photo counts as vertical. */
const TALL_RATIO = 0.9;

/** A photo's width over its height. */
export function ratioOf(photo: Shaped): number {
  return photo.image.width / photo.image.height;
}

/** Whether a photo is vertical: clearly taller than it is wide. */
function isTall(photo: Shaped): boolean {
  return ratioOf(photo) < TALL_RATIO;
}

/** How tall a photo's row is at least, for picking a sharp enough version of it. */
export function rowHeightOf(photo: Shaped): number {
  return isTall(photo) ? TALL_HEIGHT : WIDE_HEIGHT;
}

/**
 * The photos in justified rows across width pixels, keeping their order as near as it can while
 * putting vertical photos in rows of their own, which are taller, so they show larger. Each row
 * starts with the first photo not yet placed and takes the next photos of the same kind until
 * another wouldn't fit. When too few of that kind are left to fill a row, the rest are mixed into
 * rows of the wide height.
 */
export function naturalRows<T extends Shaped>(photos: T[], width: number): NaturalRow<T>[] {
  const rows: NaturalRow<T>[] = [];
  let remaining = photos;
  while (remaining.length > 0) {
    const row = nextRow(remaining, width);
    rows.push(row);
    const placed = new Set(row.photos);
    remaining = remaining.filter((photo) => !placed.has(photo));
  }
  return rows;
}

/** The next row from the photos not yet placed, the first of which it starts with. */
function nextRow<T extends Shaped>(remaining: T[], width: number): NaturalRow<T> {
  const tall = isTall(remaining[0]!);
  const alike = remaining.filter((photo) => isTall(photo) === tall);
  const height = tall ? TALL_HEIGHT : WIDE_HEIGHT;
  const row = fillRow(alike, width, height);
  if (row.length < alike.length) return { photos: row, height, full: true };
  const mixed = fillRow(remaining, width, WIDE_HEIGHT);
  return { photos: mixed, height: WIDE_HEIGHT, full: mixed.length < remaining.length };
}

/** As many of candidates, in order, as fit across width at height (at least one). */
function fillRow<T extends Shaped>(candidates: T[], width: number, height: number): T[] {
  const row: T[] = [];
  let used = -GAP_PX;
  for (const photo of candidates) {
    used += GAP_PX + ratioOf(photo) * height;
    if (row.length > 0 && used > width) break;
    row.push(photo);
  }
  return row;
}
