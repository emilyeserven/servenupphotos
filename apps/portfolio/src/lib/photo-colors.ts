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

export type HueBucket = (typeof HUE_BUCKETS)[number];

/** How much of a photo's colors are in one hue bucket. */
export interface HueShare {
  hue: HueBucket;
  /** The fraction (0–1) of the photo's colored pixels in this bucket, leaving out blacks, grays and whites. */
  share: number;
}

/** A photo's `colors`, as the pipeline saves it: only the hue buckets are read here. */
export interface PhotoColorData {
  buckets?: { name: string; share: number }[];
}

/**
 * How a photo's colors split between the hue buckets, biggest first, as shares of its colored
 * pixels only. Empty when the photo has no colors saved yet or is all blacks, grays and whites.
 */
export function photoHues(colors: PhotoColorData | null | undefined): HueShare[] {
  const buckets = (colors?.buckets ?? []).filter(
    (b): b is { name: HueBucket; share: number } => isHueBucket(b.name) && b.share > 0,
  );
  const colored = buckets.reduce((sum, b) => sum + b.share, 0);
  return buckets
    .map((b) => ({ hue: b.name, share: b.share / colored }))
    .sort((a, b) => b.share - a.share);
}

/** Whether value names one of the hue buckets, such as a `?hue=` from the URL. */
export function isHueBucket(value: unknown): value is HueBucket {
  return HUE_BUCKETS.includes(value as HueBucket);
}

/** The bucket's reference color, its hue at full saturation, as the pipeline shows it. */
export function hueSwatch(hue: HueBucket): string {
  return `hsl(${HUE_BUCKETS.indexOf(hue) * 30} 100% 50%)`;
}

/** The bucket's name to show, such as "Spring green". */
export function hueLabel(hue: HueBucket): string {
  return hue.charAt(0).toUpperCase() + hue.slice(1);
}

/** How much of a photo's colors are in hue: 0 when none are. */
export function hueShareOf(hues: HueShare[], hue: HueBucket): number {
  return hues.find((h) => h.hue === hue)?.share ?? 0;
}

/** A share as a whole percentage, such as "45%". */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
