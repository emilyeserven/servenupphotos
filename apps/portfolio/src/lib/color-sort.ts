import {
  COLORS,
  type ColorName,
  type ColorShare,
  HUE_BUCKETS,
  isShade,
  SHADES,
  shareOf,
} from "@/lib/photo-colors";

/**
 * Which way the Color page sorts every photo by color: "asc" from red around the wheel to rose and
 * then the shades from black to white, "desc" the other way.
 */
export type ColorOrder = "asc" | "desc";

/** What the Color page sorts photos by: their color (the default) or how vivid they are. */
export type ColorSort = "color" | "vivid";

/**
 * Where a photo sits in the sort, from 0 (red) to just under 17 (white): its largest color's place,
 * nudged toward whichever neighboring color it has more of, so photos with the same largest color
 * still run smoothly into the next one.
 */
function colorPosition(palette: ColorShare[]): number {
  const top = palette[0];
  if (!top) return 0;
  const prev = shareOf(palette, neighbor(top.color, -1));
  const next = shareOf(palette, neighbor(top.color, 1));
  return COLORS.indexOf(top.color) + (next - prev) / (2 * (top.share + prev + next));
}

/**
 * The color step places from color: around the wheel for a hue bucket, wrapping from rose back to
 * red, or the next darker or lighter shade, with none past black or white.
 */
function neighbor(color: ColorName, step: number): ColorName | undefined {
  if (isShade(color)) return SHADES[SHADES.indexOf(color) + step];
  const index = HUE_BUCKETS.indexOf(color);
  return HUE_BUCKETS[(index + step + HUE_BUCKETS.length) % HUE_BUCKETS.length];
}

/**
 * Which vividness the Color page sorts and filters by: "average", the photo's mean chroma, or
 * "peak", the chroma its most vivid tenth reaches.
 */
export type VividMeasure = "average" | "peak";

/** A photo's two vividness values. */
interface Vivid {
  vividness: number;
  peakVividness: number;
}

/** A photo's vividness by measure. */
export function vividnessOf(photo: Vivid, measure: VividMeasure): number {
  return measure === "peak" ? photo.peakVividness : photo.vividness;
}

/** Photos sorted by their vividness by measure, the least vivid first for "asc", keeping their order where they tie. */
export function sortByVividness<T extends Vivid>(
  photos: T[],
  order: ColorOrder,
  measure: VividMeasure,
): T[] {
  const sign = order === "asc" ? 1 : -1;
  return photos.toSorted((a, b) => sign * (vividnessOf(a, measure) - vividnessOf(b, measure)));
}

/** Photos sorted by color in order, keeping their order where they tie. */
export function sortByColor<T extends { palette: ColorShare[] }>(
  photos: T[],
  order: ColorOrder,
): T[] {
  const sign = order === "asc" ? 1 : -1;
  return photos
    .map((photo) => ({ photo, position: colorPosition(photo.palette) }))
    .sort((a, b) => sign * (a.position - b.position))
    .map(({ photo }) => photo);
}
