/** How big the Color page's photo pins are: small (the default, left out of the URL), medium or large. */
export type PinScale = "small" | "medium" | "large";

/** How much bigger than small each size draws the pins. */
const SCALES: Record<PinScale, number> = { small: 1, medium: 1.5, large: 2 };

/** The `?pins=` size, or nothing when it's missing, small, or not a size. */
export function parsePinScale(value: unknown): Exclude<PinScale, "small"> | undefined {
  return value === "medium" || value === "large" ? value : undefined;
}

/** How much bigger than small the pins are drawn at scale. */
export function pinFactor(scale: PinScale = "small"): number {
  return SCALES[scale];
}
