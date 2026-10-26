import type { RowSizes } from "@/lib/natural-rows";

/**
 * How big the Grid's photos are, picked in its display options. Square tiles and the Table come in
 * Small, Medium and Large; Natural tiles also come in X-Large.
 */
export type GridSize = "small" | "medium" | "large" | "xlarge";

/** The sizes Square tiles and the Table come in. */
export type CommonSize = Exclude<GridSize, "xlarge">;

/** Which of the Grid's views a size is for. */
export type SizedView = "square" | "natural" | "table";

/** Each size's label, in order. */
const LABELS: [GridSize, string][] = [
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
  ["xlarge", "X-Large"],
];

/**
 * The size each view starts at: Medium for Square tiles, Large for Natural tiles (the size they had
 * before there were smaller ones), and Small for the Table.
 */
const DEFAULT_SIZES: Record<SizedView, GridSize> = {
  square: "medium",
  natural: "large",
  table: "small",
};

/** The size from the URL's `?size=`, left out when it isn't one. */
export function parseGridSize(size: unknown): { size?: GridSize } {
  return LABELS.some(([known]) => known === size) ? { size: size as GridSize } : {};
}

/** The sizes a view comes in, with their labels. */
export function sizeChoices(view: SizedView): [GridSize, string][] {
  return view === "natural" ? LABELS : LABELS.slice(0, 3);
}

/** The size Natural tiles show at: the URL's, or Large when it has none. */
export function naturalSize(size: GridSize | undefined): GridSize {
  return size ?? DEFAULT_SIZES.natural;
}

/** The size Square tiles show at: the URL's, as Large for X-Large, or Medium when it has none. */
export function squareSize(size: GridSize | undefined): CommonSize {
  return common(size ?? DEFAULT_SIZES.square);
}

/** The size the Table shows at: the URL's, as Large for X-Large, or Small when it has none. */
export function tableSize(size: GridSize | undefined): CommonSize {
  return common(size ?? DEFAULT_SIZES.table);
}

/** The size as one Square tiles and the Table come in, which is Large for X-Large. */
function common(size: GridSize): CommonSize {
  return size === "xlarge" ? "large" : size;
}

/** The `?size=` for a view's size, left out when it's the size the view starts at. */
export function sizeParam(view: SizedView, size: GridSize): GridSize | undefined {
  return size === DEFAULT_SIZES[view] ? undefined : size;
}

/**
 * How big Natural rows start out at each size: the height of rows of wide photos and the width of
 * vertical photos. Large is the size they had before there were smaller ones.
 */
export const NATURAL_ROW_SIZES: Record<GridSize, RowSizes> = {
  small: { wide: 100, tall: 200 },
  medium: { wide: 150, tall: 300 },
  large: { wide: 250, tall: 400 },
  xlarge: { wide: 350, tall: 500 },
};

/** Square tiles' columns at each size: fewer columns make bigger tiles. */
export const SQUARE_COLUMNS: Record<CommonSize, string> = {
  small: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
  medium: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  large: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
};

/**
 * How wide a Square tile is at each breakpoint and size, matching its columns, so the browser picks
 * the smallest version that's still sharp.
 */
export const SQUARE_TILE_SIZES: Record<CommonSize, string> = {
  small:
    "(min-width: 1536px) 13vw, (min-width: 1280px) 17vw, (min-width: 1024px) 20vw, (min-width: 640px) 25vw, 33vw",
  medium:
    "(min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  large:
    "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
};

/** How big the Table's thumbnails are at each size: 40px, 80px and 128px. */
export const TABLE_THUMBNAILS: Record<CommonSize, string> = {
  small: "size-10",
  medium: "size-20",
  large: "size-32",
};
