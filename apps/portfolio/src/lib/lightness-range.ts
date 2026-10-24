/** A range of CIELAB lightness, from its darkest to its lightest end, each 0 (black) to 100 (white). */
export type LightnessRange = [number, number];

/** The step the chart's ends are rounded out to. */
const LIGHTNESS_STEP = 5;

/** The least range the chart fits to, so a few photos of one gray aren't spread across it. */
const MIN_EXTENT = 10;

/**
 * The range of lightness that fits lightnesses, rounded out to steps of 5, at least MIN_EXTENT
 * wide and within 0 to 100: the Black & white chart's ends. The whole spectrum when there are none.
 */
export function lightnessExtent(lightnesses: number[]): LightnessRange {
  if (lightnesses.length === 0) return [0, 100];
  const low = stepDown(Math.min(...lightnesses));
  const high = Math.max(stepUp(Math.max(...lightnesses)), low + MIN_EXTENT);
  return high > 100 ? [Math.min(low, 100 - MIN_EXTENT), 100] : [low, high];
}

/** n rounded down to a step. */
function stepDown(n: number): number {
  return Math.floor(n / LIGHTNESS_STEP) * LIGHTNESS_STEP;
}

/** n rounded up to a step. */
function stepUp(n: number): number {
  return Math.ceil(n / LIGHTNESS_STEP) * LIGHTNESS_STEP;
}

/** The gray of a CIELAB lightness, as a CSS color: lightness turned into relative luminance, then sRGB. */
function lightnessGray(lightness: number): string {
  const f = (lightness + 16) / 116;
  const luminance = lightness > 8 ? f ** 3 : lightness / 903.3;
  const srgb = luminance <= 0.0031308 ? 12.92 * luminance : 1.055 * luminance ** (1 / 2.4) - 0.055;
  const channel = Math.round(srgb * 255);
  return `rgb(${channel} ${channel} ${channel})`;
}

/** The grays from one end of extent to the other, as a CSS gradient. */
export function graysOf([low, high]: LightnessRange): string {
  return `linear-gradient(to right, ${lightnessGray(low)}, ${lightnessGray(high)})`;
}
