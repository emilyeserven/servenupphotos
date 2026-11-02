import { layoutNaturalRows, useMeasuredWidth } from "@/components/natural-grid";
import type { ImagePhoto, TileMode } from "@/components/photo-tiles";
import {
  type GridSize,
  NATURAL_ROW_SIZES,
  naturalSize,
  squareColumnCount,
  squareSize,
} from "@/lib/grid-size";
import { DEFAULT_LUCKY_ROWS, type LuckyChoice, LUCKY_ROWS, type LuckyRows } from "@/lib/lucky";
import type { NaturalRow } from "@/lib/natural-rows";
import { useWindowWidth } from "@/lib/use-window-width";

/** What the Lucky page shows: its photos, how they're laid out, and the dropdown's choices. */
export interface LuckyDraw {
  /** The photos shown, in the order they were drawn. */
  photos: ImagePhoto[];
  /** For Natural tiles, the rows they're laid out in; left out for Square tiles. */
  rows?: NaturalRow<ImagePhoto>[];
  /** Each number of rows the dropdown offers, and how many photos it would show. */
  choices: LuckyChoice[];
}

/** The page's tile shape, size and number of rows, as read from the URL. */
export interface LuckyLayout {
  mode: TileMode;
  size: GridSize | undefined;
  rows: LuckyRows | undefined;
}

/**
 * Takes whole rows of photos from the shuffled pool, so every row the Lucky page shows is full.
 * Square rows hold as many tiles as there are columns at the window's width; Natural rows are laid
 * out across the measured width, the way the Grid's are. Returns a ref for the element the tiles
 * go in, which Natural rows are measured by.
 */
export function useLuckyDraw(order: ImagePhoto[], layout: LuckyLayout) {
  const [ref, width] = useMeasuredWidth();
  const windowWidth = useWindowWidth();
  const draw =
    layout.mode === "natural"
      ? naturalDraw(order, width, layout)
      : squareDraw(order, squareColumnCount(squareSize(layout.size), windowWidth), layout);
  return [ref, draw] as const;
}

/** The first few full rows of Square tiles, `columns` to a row. */
function squareDraw(order: ImagePhoto[], columns: number, layout: LuckyLayout): LuckyDraw {
  const rows = layout.rows ?? DEFAULT_LUCKY_ROWS;
  return {
    photos: order.slice(0, rows * columns),
    choices: LUCKY_ROWS.map((choice) => ({
      rows: choice,
      photos: Math.min(choice * columns, order.length),
    })),
  };
}

/** The first few Natural rows of the shuffled pool laid out across width pixels. */
function naturalDraw(order: ImagePhoto[], width: number, layout: LuckyLayout): LuckyDraw {
  const all = layoutNaturalRows(order, width, NATURAL_ROW_SIZES[naturalSize(layout.size)]);
  const rows = all.slice(0, layout.rows ?? DEFAULT_LUCKY_ROWS);
  return {
    photos: rows.flatMap((row) => row.photos),
    rows,
    choices: LUCKY_ROWS.map((choice) => ({ rows: choice, photos: photosIn(all, choice) })),
  };
}

/** How many photos the first `count` rows hold. */
function photosIn(rows: NaturalRow<ImagePhoto>[], count: number): number {
  return rows.slice(0, count).reduce((total, row) => total + row.photos.length, 0);
}
