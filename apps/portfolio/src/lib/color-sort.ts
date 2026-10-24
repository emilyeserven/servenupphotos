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
 * secondary the shades from black to white, "desc" the other way.
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

/** A photo the Color page can sort: its colors and both its vividness values. */
type Sortable = Vivid & { palette: ColorShare[] };

/** How the Color page sorts its photos. */
export interface SortSpec {
  sort: ColorSort;
  order: ColorOrder;
  /** The secondary sort, used within the groups the main sort makes; undefined for none. */
  secondary?: ColorSort;
  secondaryOrder: ColorOrder;
  measure: VividMeasure;
  /** The picked color, whose share the color sort uses instead of the color wheel: the most of it first. */
  color?: ColorName;
}

/**
 * How wide a group of the main sort is when there's a secondary sort: 10 points of vividness, or
 * 10% of the picked color. Without a picked color, a color group is each photo's largest color.
 */
const VIVID_BAND = 10;
const SHARE_BAND = 0.1;

/** A sort key for a photo, smaller first for ascending. */
type SortKey = (photo: Sortable) => number;

/**
 * Photos sorted as spec asks, keeping their order where they tie. With a secondary sort, the main
 * sort groups photos (by largest color, a band of the picked color's share, or a band of
 * vividness) and the secondary sorts within each group.
 */
export function sortPhotos<T extends Sortable>(photos: T[], spec: SortSpec): T[] {
  const primary = keyFor(spec.sort, spec, spec.secondary !== undefined);
  const secondary = keyFor(spec.secondary ?? spec.sort, spec, false);
  const first = signOf(spec.order);
  const second = signOf(spec.secondaryOrder);
  return photos
    .map((photo) => ({ photo, a: primary(photo), b: secondary(photo) }))
    .sort((x, y) => first * (x.a - y.a) || second * (x.b - y.b))
    .map(({ photo }) => photo);
}

/** 1 for ascending, -1 for descending. */
function signOf(order: ColorOrder): number {
  return order === "asc" ? 1 : -1;
}

/** The key sort uses, grouped into bands when grouped. */
function keyFor(sort: ColorSort, spec: SortSpec, grouped: boolean): SortKey {
  return sort === "vivid" ? vividKey(spec.measure, grouped) : colorKey(spec.color, grouped);
}

/** A photo's vividness by measure, or which band of it the photo is in when grouped. */
function vividKey(measure: VividMeasure, grouped: boolean): SortKey {
  const key: SortKey = (photo) => vividnessOf(photo, measure);
  return grouped ? (photo) => Math.floor(key(photo) / VIVID_BAND) : key;
}

/**
 * Where a photo sits by color: its place around the wheel and through the shades, or with a
 * picked color, how little of it the photo has, so the most comes first. When grouped, its largest
 * color, or which band of the picked color's share it's in.
 */
function colorKey(color: ColorName | undefined, grouped: boolean): SortKey {
  const key: SortKey = color
    ? (photo) => 1 - shareOf(photo.palette, color)
    : (photo) => colorPosition(photo.palette);
  const band = color ? SHARE_BAND : 1;
  return grouped ? (photo) => Math.round(key(photo) / band) : key;
}
