/** A range of CIELAB lightness, from its darkest to its lightest end, each 0 (black) to 100 (white). */
export type LightnessRange = [number, number];

/** How far the lightness slider's handles move each step. */
export const LIGHTNESS_STEP = 5;

/** Whether n is a lightness the slider can set: a whole step from 0 to 100. */
function isStep(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 100 && n % LIGHTNESS_STEP === 0;
}

/**
 * The `?light=` from the URL, such as "20-60", when it's a range the slider can set and narrower
 * than the whole spectrum; undefined otherwise.
 */
export function parseLightness(value: unknown): string | undefined {
  const ends = /^(\d+)-(\d+)$/.exec(String(value));
  if (!ends) return undefined;
  const range: LightnessRange = [Number(ends[1]), Number(ends[2])];
  return isNarrower(range) ? lightnessParam(range) : undefined;
}

/** Whether a range's ends are steps the slider can set, in order, and not the whole spectrum. */
function isNarrower([low, high]: LightnessRange): boolean {
  return isStep(low) && isStep(high) && low < high && !isWhole([low, high]);
}

/**
 * The range a `?light=` names, kept within extent (the photos' range, the chart's ends), or the
 * whole extent when it's left out.
 */
export function lightnessRange(value: string | undefined, extent: LightnessRange): LightnessRange {
  const [low = extent[0], high = extent[1]] = value?.split("-").map(Number) ?? [];
  return [Math.max(low, extent[0]), Math.min(high, extent[1])];
}

/** The `?light=` for a range, left out when it's the whole of extent (or of the spectrum). */
export function lightnessParam(
  [low, high]: LightnessRange,
  extent: LightnessRange = [0, 100],
): string | undefined {
  return low === extent[0] && high === extent[1] ? undefined : `${low}-${high}`;
}

/** The least range the chart fits to, so a few photos of one gray aren't spread across it. */
const MIN_EXTENT = 10;

/**
 * The range of lightness that fits lightnesses, rounded out to slider steps, at least MIN_EXTENT
 * wide and within 0 to 100: the Black & white chart's ends. The whole spectrum when there are none.
 */
export function lightnessExtent(lightnesses: number[]): LightnessRange {
  if (lightnesses.length === 0) return [0, 100];
  const low = stepDown(Math.min(...lightnesses));
  const high = Math.max(stepUp(Math.max(...lightnesses)), low + MIN_EXTENT);
  return high > 100 ? [Math.min(low, 100 - MIN_EXTENT), 100] : [low, high];
}

/** n rounded down to a slider step. */
function stepDown(n: number): number {
  return Math.floor(n / LIGHTNESS_STEP) * LIGHTNESS_STEP;
}

/** n rounded up to a slider step. */
function stepUp(n: number): number {
  return Math.ceil(n / LIGHTNESS_STEP) * LIGHTNESS_STEP;
}

/** The gray of a CIELAB lightness, as a CSS color: lightness turned into relative luminance, then sRGB. */
export function lightnessGray(lightness: number): string {
  const f = (lightness + 16) / 116;
  const luminance = lightness > 8 ? f ** 3 : lightness / 903.3;
  const srgb = luminance <= 0.0031308 ? 12.92 * luminance : 1.055 * luminance ** (1 / 2.4) - 0.055;
  const channel = Math.round(srgb * 255);
  return `rgb(${channel} ${channel} ${channel})`;
}

/** Whether a range covers the whole spectrum. */
function isWhole([low, high]: LightnessRange): boolean {
  return low === 0 && high === 100;
}

/** Whether lightness is within range, its ends included. */
export function inLightness(lightness: number, [low, high]: LightnessRange): boolean {
  return lightness >= low && lightness <= high;
}
