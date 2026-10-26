import { DEFAULT_ROW_SIZES, type RowSizes } from "@/lib/natural-rows";

/**
 * How big the Grid's tiles are, picked in its display options. **Small** is only for Natural
 * tiles; Square tiles at Small show at Medium.
 */
export type GridSize = "small" | "medium" | "large" | "xlarge";

/** The sizes the URL can ask for, besides the default, Medium. */
const URL_SIZES: readonly string[] = ["small", "large", "xlarge"];

/** The size from the URL's `?size=`, left out for Medium. */
export function parseGridSize(size: unknown): { size?: Exclude<GridSize, "medium"> } {
  return URL_SIZES.includes(size as string) ? { size: size as Exclude<GridSize, "medium"> } : {};
}

/** Each size with its label, for the Natural tiles' options. */
const NATURAL_CHOICES: [GridSize, string][] = [
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
  ["xlarge", "X-Large"],
];

/** The sizes each kind of tile can be, with their labels; Square tiles don't go smaller. */
export function sizeChoices(natural: boolean): [GridSize, string][] {
  return natural ? NATURAL_CHOICES : NATURAL_CHOICES.slice(1);
}

/** The size Square tiles show at, which is Medium for Small. */
export function squareSize(size: GridSize): Exclude<GridSize, "small"> {
  return size === "small" ? "medium" : size;
}

/** How many 100px steps each size is from Medium. */
const STEPS: Record<GridSize, number> = { small: -1, medium: 0, large: 1, xlarge: 2 };

/**
 * How big Natural rows start out at a size: each size is 100px away from the next, both in the
 * height of rows of wide photos (150px to 450px) and in the width of vertical photos (300px to
 * 600px).
 */
export function naturalRowSizes(size: GridSize): RowSizes {
  const step = STEPS[size] * 100;
  return { wide: DEFAULT_ROW_SIZES.wide + step, tall: DEFAULT_ROW_SIZES.tall + step };
}

/** Square tiles' columns at each size: fewer columns make bigger tiles. */
export const SQUARE_COLUMNS: Record<Exclude<GridSize, "small">, string> = {
  medium: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  large: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
  xlarge: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
};

/**
 * How wide a Square tile is at each breakpoint and size, matching its columns, so the browser picks
 * the smallest version that's still sharp.
 */
export const SQUARE_TILE_SIZES: Record<Exclude<GridSize, "small">, string> = {
  medium:
    "(min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  large:
    "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  xlarge: "(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw",
};
