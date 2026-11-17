import {
  GAP_PX,
  type NaturalRow,
  ratioOf,
  rowHeightOf,
  type RowSizes,
  type Shaped,
} from "@/lib/natural-rows";

/**
 * How much taller than their starting height rows aim to be. The Natural view's rows start at
 * their height and grow to fill the width, coming out about this much taller on a laptop, so
 * ordered rows aim for this to show photos about as big at each **Size**.
 */
const AIM_GROWTH = 1.25;

/** How much shorter than it aims for a row can get before no more photos are put in it. */
const MIN_HEIGHT_SHARE = 0.5;

/** One way to end a row: where the row before it ends, and how far off the best it all is. */
interface Break {
  /** The index of the first photo in the row. */
  start: number;
  /** How far the rows up to and including this one are from their aimed heights, added up. */
  cost: number;
}

/**
 * The photos in justified rows across width pixels, strictly in their order: reading left to right
 * and top to bottom gives the photos in the order they came, with wide and vertical photos mixed in
 * the same rows. Each row aims for the height its photos would start at in the Natural view
 * (`rowHeightOf`, averaged over the row), so a row with vertical photos comes out taller and they
 * stay about as big as wide ones. Where the rows break is picked across all of them at once, like
 * a word processor justifying a paragraph, so no row is squashed to fit the ones before it. A full
 * row fills the width exactly; the last row keeps its aimed height when filling would make it
 * taller, and no row is taller than maxHeight pixels.
 */
export function orderedRows<T extends Shaped>(
  photos: T[],
  width: number,
  maxHeight: number,
  sizes: RowSizes,
): NaturalRow<T>[] {
  const breaks = bestBreaks(photos, width, maxHeight, sizes);
  const rows: NaturalRow<T>[] = [];
  for (let end = photos.length; end > 0; end = breaks[end]!.start) {
    const row = photos.slice(breaks[end]!.start, end);
    rows.unshift(sized(row, width, maxHeight, sizes, end === photos.length));
  }
  return rows;
}

/** For each place a row can end (after `i` photos), the cheapest way to get there. */
function bestBreaks<T extends Shaped>(
  photos: T[],
  width: number,
  maxHeight: number,
  sizes: RowSizes,
): Break[] {
  const breaks: Break[] = [{ start: 0, cost: 0 }];
  for (let end = 1; end <= photos.length; end++) {
    let best: Break = { start: end - 1, cost: Infinity };
    for (let start = end - 1; start >= 0; start--) {
      const fit = rowFit(photos.slice(start, end), width, maxHeight, sizes);
      const cost = breaks[start]!.cost + rowCost(fit, end === photos.length);
      if (cost < best.cost) best = { start, cost };
      if (fit.height < fit.aim * MIN_HEIGHT_SHARE) break;
    }
    breaks.push(best);
  }
  return breaks;
}

/** How tall a row is when it fills the width, and how tall it aims to be. */
interface RowFit {
  height: number;
  aim: number;
}

/** How tall the photos are when they fill width pixels side by side, and the height they aim for. */
function rowFit<T extends Shaped>(
  row: T[],
  width: number,
  maxHeight: number,
  sizes: RowSizes,
): RowFit {
  const ratios = row.reduce((total, photo) => total + ratioOf(photo), 0);
  const aims = row.reduce((total, photo) => total + rowHeightOf(photo, sizes), 0);
  return {
    height: (width - GAP_PX * (row.length - 1)) / ratios,
    aim: Math.min((aims / row.length) * AIM_GROWTH, maxHeight),
  };
}

/**
 * How far a row is from the height it aims for, by how many times bigger or smaller it is, so
 * half as tall counts as much as twice as tall. The last row costs nothing when it's taller than
 * it aims for, since it's left at its aimed height instead of filling the width.
 */
function rowCost(fit: RowFit, last: boolean): number {
  if (last && fit.height >= fit.aim) return 0;
  return Math.log(fit.height / fit.aim) ** 2;
}

/** A row at the height it shows at: filling the width, or at its aimed height when that's smaller. */
function sized<T extends Shaped>(
  row: T[],
  width: number,
  maxHeight: number,
  sizes: RowSizes,
  last: boolean,
): NaturalRow<T> {
  const fit = rowFit(row, width, maxHeight, sizes);
  const capped = last ? fit.aim : maxHeight;
  if (fit.height > capped) return { photos: row, height: capped, full: false };
  return { photos: row, height: fit.height, full: true };
}
