import { type HueShare, type HueBucket, hueLabel, hueShareOf, percent } from "@/lib/photo-colors";

/**
 * How a photo matches a hue on the Color page: "largest" when the hue is the biggest of its
 * colors, or "threshold" when the hue is at least minShare of them.
 */
export type ColorMatch = { mode: "largest" } | { mode: "threshold"; minShare: number };

/** Whether a photo with these hues shows under hue. */
export function matchesHue(hues: HueShare[], hue: HueBucket, match: ColorMatch): boolean {
  if (match.mode === "largest") return hues[0]?.hue === hue;
  return hueShareOf(hues, hue) >= match.minShare;
}

/** What the photos shown under hue have, such as "mostly orange" or "at least 30% orange". */
export function matchText(hue: HueBucket, match: ColorMatch): string {
  const name = hueLabel(hue).toLowerCase();
  return match.mode === "largest"
    ? `mostly ${name}`
    : `at least ${percent(match.minShare)} ${name}`;
}
