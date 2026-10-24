/** The 12 hue buckets the pipeline sorts a photo's colors into, every 30° around the color wheel from red. */
export const HUE_BUCKETS = [
  "red",
  "orange",
  "yellow",
  "chartreuse",
  "green",
  "spring green",
  "cyan",
  "azure",
  "blue",
  "violet",
  "magenta",
  "rose",
] as const;

/**
 * The shades a photo's blacks, grays and whites are split into, from dark to light, each a fifth of
 * CIELAB lightness: black under 20, then dark gray, gray and light gray, and white from 80.
 */
export const SHADES = ["black", "dark gray", "gray", "light gray", "white"] as const;

/** Every color the Color page knows: the hue buckets around the wheel, then the shades. */
export const COLORS = [...HUE_BUCKETS, ...SHADES] as const;

type HueBucket = (typeof HUE_BUCKETS)[number];
export type Shade = (typeof SHADES)[number];
export type ColorName = (typeof COLORS)[number];

/** How much of a photo is one hue bucket or shade. */
export interface ColorShare {
  color: ColorName;
  /** The fraction (0–1) of the whole photo in this color. */
  share: number;
}

/** A photo's `colors`, as the pipeline saves it: only the hue buckets and the neutral histogram are read here. */
export interface PhotoColorData {
  buckets?: { name: string; share: number }[];
  /** The blacks, grays and whites, split into lightness bins from 0 (black) to 100 (white). */
  neutrals?: { histogram?: { from: number; share: number }[] };
}

/** Each shade's reference color: a gray at the middle of its lightness, and white. */
const SHADE_SWATCHES: Record<Shade, string> = {
  black: "#1b1b1b",
  "dark gray": "#474747",
  gray: "#777777",
  "light gray": "#ababab",
  white: "#f8f8f8",
};

/**
 * How a photo's colors split between the hue buckets and shades, biggest first, as shares of the
 * whole photo. Empty when the photo has no colors saved yet.
 */
export function photoColors(colors: PhotoColorData | null | undefined): ColorShare[] {
  const shares = new Map<ColorName, number>();
  for (const { color, share } of [...hueShares(colors), ...shadeShares(colors)]) {
    shares.set(color, (shares.get(color) ?? 0) + share);
  }
  return [...shares]
    .filter(([, share]) => share > 0)
    .map(([color, share]) => ({ color, share }))
    .sort((a, b) => b.share - a.share);
}

/** The photo's hue buckets, as the pipeline saves them. */
function hueShares(colors: PhotoColorData | null | undefined): ColorShare[] {
  return (colors?.buckets ?? [])
    .filter((b): b is { name: HueBucket; share: number } => isHueBucket(b.name))
    .map((b) => ({ color: b.name, share: b.share }));
}

/** The photo's neutral lightness bins, each counted toward the shade it falls in. */
function shadeShares(colors: PhotoColorData | null | undefined): ColorShare[] {
  return (colors?.neutrals?.histogram ?? []).map((bin) => ({
    color: shadeOf(bin.from),
    share: bin.share,
  }));
}

/** The shade a CIELAB lightness from 0 to 100 falls in. */
function shadeOf(lightness: number): Shade {
  const index = Math.min(SHADES.length - 1, Math.max(0, Math.floor(lightness / 20)));
  return SHADES[index]!;
}

/** Whether value names one of the hue buckets. */
function isHueBucket(value: unknown): value is HueBucket {
  return HUE_BUCKETS.includes(value as HueBucket);
}

/** Whether color is one of the shades rather than a hue bucket. */
export function isShade(color: ColorName): color is Shade {
  return SHADES.includes(color as Shade);
}

/** Whether value names one of the hue buckets or shades, such as a `?color=` from the URL. */
export function isColorName(value: unknown): value is ColorName {
  return COLORS.includes(value as ColorName);
}

/** The color's reference color: a hue bucket at full saturation, as the pipeline shows it, or the shade's gray. */
export function colorSwatch(color: ColorName): string {
  return isShade(color) ? SHADE_SWATCHES[color] : `hsl(${COLORS.indexOf(color) * 30} 100% 50%)`;
}

/** The color's name to show, such as "Spring green" or "Dark gray". */
export function colorLabel(color: ColorName): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

/** How much of a photo is color: 0 when none is, or for no color at all. */
export function shareOf(palette: ColorShare[], color: ColorName | undefined): number {
  return palette.find((c) => c.color === color)?.share ?? 0;
}

/** A share as a whole percentage, such as "45%". */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
