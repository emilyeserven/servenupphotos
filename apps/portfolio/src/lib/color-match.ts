import { type ColorName, type ColorShare, colorLabel, percent, shareOf } from "@/lib/photo-colors";

/**
 * How a photo matches a color on the Color page: "largest" when the color is the biggest part of
 * the photo, or "threshold" when it's at least minShare of it.
 */
export type ColorMatch = { mode: "largest" } | { mode: "threshold"; minShare: number };

/** Whether a photo with this palette shows under color. */
export function matchesColor(palette: ColorShare[], color: ColorName, match: ColorMatch): boolean {
  if (match.mode === "largest") return palette[0]?.color === color;
  return shareOf(palette, color) >= match.minShare;
}

/** What the photos shown under color have, such as "mostly orange" or "at least 30% orange". */
export function matchText(color: ColorName, match: ColorMatch): string {
  const name = colorLabel(color).toLowerCase();
  return match.mode === "largest"
    ? `mostly ${name}`
    : `at least ${percent(match.minShare)} ${name}`;
}
