import { HUE_BUCKETS, type HueShare, hueShareOf } from "@/lib/photo-colors";

/**
 * Which way the Color page sorts every photo around the color wheel: "asc" from red through
 * orange, yellow and green to rose, "desc" the other way.
 */
export type ColorOrder = "asc" | "desc";

/**
 * Where a photo's colors sit on the color wheel, from 0 (red) to just under 12 (rose): its largest
 * hue bucket's place, nudged toward whichever neighboring bucket it has more of, so photos with
 * the same largest color still run smoothly into the next one.
 */
function huePosition(hues: HueShare[]): number {
  const top = hues[0];
  if (!top) return 0;
  const index = HUE_BUCKETS.indexOf(top.hue);
  const prev = hueShareOf(hues, neighbor(index, -1));
  const next = hueShareOf(hues, neighbor(index, 1));
  return index + (next - prev) / (2 * (top.share + prev + next));
}

/** The hue bucket step places from index around the wheel, wrapping from rose back to red. */
function neighbor(index: number, step: number) {
  return HUE_BUCKETS[(index + step + HUE_BUCKETS.length) % HUE_BUCKETS.length]!;
}

/** Photos sorted around the color wheel in order, keeping their order where they tie. */
export function sortByColor<T extends { hues: HueShare[] }>(photos: T[], order: ColorOrder): T[] {
  const sign = order === "asc" ? 1 : -1;
  return photos
    .map((photo) => ({ photo, position: huePosition(photo.hues) }))
    .sort((a, b) => sign * (a.position - b.position))
    .map(({ photo }) => photo);
}
