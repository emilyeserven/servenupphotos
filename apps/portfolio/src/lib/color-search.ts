import { parseThreshold } from "@/components/color-match-control";
import { parseVividness } from "@/components/vividness-control";
import { type ColorMatch, matchesColor } from "@/lib/color-match";
import type { ColorOrder, ColorSort, VividMeasure } from "@/lib/color-sort";
import { COLORS, type ColorName, type ColorShare, isColorName } from "@/lib/photo-colors";

/**
 * The color filters the Color page and the Grid's **Colors** filter keep in the URL, each left out
 * at its default.
 */
export interface ColorFilters {
  /** The hue bucket or shade to show photos of; left out to show every photo. */
  color?: ColorName;
  /** Set to match photos by a share of the color; left out to match the photos it's the largest color of. */
  match?: "threshold";
  /** How much of a photo, in percent, the color needs to match by share; left out for DEFAULT_PERCENT. */
  min?: number;
  /** The least vividness a photo needs to show, from 0 to 100; left out for 0, which shows every photo. */
  vivid?: number;
  /** Set to filter (and sort) by peak vividness; left out for the average. */
  measure?: VividMeasure;
}

/** The color filters' keys in the URL, which **Clear filters** clears. */
export const COLOR_FILTER_KEYS = ["color", "match", "min", "vivid", "measure"] as const;

/**
 * How much of a photo, in percent, a color needs by default to match by share, so a photo
 * shows for its main colors, not every speck. The slider changes it.
 */
export const DEFAULT_PERCENT = 30;

/** The color filters in the URL, leaving out any that aren't ones the controls can set. */
export function parseColorFilters(search: Record<string, unknown>): ColorFilters {
  return {
    ...(isColorName(search.color) ? { color: search.color } : {}),
    ...(search.match === "threshold" ? { match: "threshold" as const } : {}),
    ...defined("min", parseThreshold(search.min)),
    ...defined("vivid", parseVividness(search.vivid)),
    ...(search.measure === "peak" ? { measure: "peak" as const } : {}),
  };
}

/** `{ [key]: value }`, or nothing when value is undefined. */
function defined<K extends string>(key: K, value: number | undefined) {
  return value === undefined ? {} : ({ [key]: value } as Record<K, number>);
}

/** How many color filters are set, for the filter button's count: the color and the vividness. */
export function colorFilterCount({ color, vivid }: ColorFilters): number {
  return Number(color !== undefined) + Number(Boolean(vivid));
}

/** How photos match the picked color, from the URL. */
export function matchOf({ match, min = DEFAULT_PERCENT }: ColorFilters): ColorMatch {
  return match === "threshold" ? { mode: "threshold", minShare: min / 100 } : { mode: "largest" };
}

/** A photo the color filters can check: its colors and vividness, null before they're saved. */
interface ColorChecked {
  palette: ColorShare[];
  vividness: number | null;
  peakVividness: number | null;
}

/** A photo's vividness by measure, or null before its colors are saved. */
function vividnessOrNull(photo: ColorChecked, measure: VividMeasure = "average"): number | null {
  return measure === "peak" ? photo.peakVividness : photo.vividness;
}

/** The photos at least as vivid as the URL asks, by its measure; every photo at 0. */
export function vividEnough<T extends ColorChecked>(list: T[], filters: ColorFilters): T[] {
  const { vivid = 0, measure } = filters;
  if (vivid === 0) return list;
  return list.filter((photo) => (vividnessOrNull(photo, measure) ?? -1) >= vivid);
}

/** The photos of list that match color. */
function photosOf<T extends ColorChecked>(list: T[], color: ColorName, match: ColorMatch): T[] {
  return list.filter((photo) => matchesColor(photo.palette, color, match));
}

/** How many photos of pool each color's swatch would show. */
export function countsFor(pool: ColorChecked[], match: ColorMatch): Record<ColorName, number> {
  return Object.fromEntries(
    COLORS.map((color) => [color, photosOf(pool, color, match).length]),
  ) as Record<ColorName, number>;
}

/** The photos the color filters leave: vivid enough, and matching the picked color if there is one. */
export function filterByColors<T extends ColorChecked>(list: T[], filters: ColorFilters): T[] {
  const pool = vividEnough(list, filters);
  return filters.color ? photosOf(pool, filters.color, matchOf(filters)) : pool;
}

/** The Grid's color or vividness sort's settings in the URL, each left out at its default. */
export interface ColorOrderSearch {
  /** Set to sort the other way; left out for ascending. */
  order?: ColorOrder;
  /** The secondary sort, always the one the main sort isn't; left out for none. */
  secondary?: ColorSort;
  /** Set to run the secondary sort the other way; left out for ascending. */
  secondaryOrder?: ColorOrder;
}

/** The `?order=`, `?secondary=` and `?secondaryOrder=` to keep for the main sort. */
export function parseColorOrder(
  main: ColorSort,
  search: Record<string, unknown>,
): ColorOrderSearch {
  const other: ColorSort = main === "vivid" ? "color" : "vivid";
  return {
    ...descOf("order", search.order),
    ...(search.secondary === other ? { secondary: other } : {}),
    ...descOf("secondaryOrder", search.secondaryOrder),
  };
}

/** `{ [key]: "desc" }` when value is "desc", which is all an order keeps. */
function descOf(key: "order" | "secondaryOrder", value: unknown): ColorOrderSearch {
  return value === "desc" ? { [key]: "desc" as const } : {};
}
