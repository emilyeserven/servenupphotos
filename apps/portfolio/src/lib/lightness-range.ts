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

/** The range a `?light=` names, or the whole spectrum when it's left out. */
export function lightnessRange(value: string | undefined): LightnessRange {
  const [low = 0, high = 100] = value?.split("-").map(Number) ?? [];
  return [low, high];
}

/** The `?light=` for a range, left out for the whole spectrum. */
export function lightnessParam([low, high]: LightnessRange): string | undefined {
  return isWhole([low, high]) ? undefined : `${low}-${high}`;
}

/** Whether a range covers the whole spectrum. */
function isWhole([low, high]: LightnessRange): boolean {
  return low === 0 && high === 100;
}

/** Whether lightness is within range, its ends included. */
export function inLightness(lightness: number, [low, high]: LightnessRange): boolean {
  return lightness >= low && lightness <= high;
}
