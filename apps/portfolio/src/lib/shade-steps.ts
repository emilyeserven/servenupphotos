/** How many steps of gray the Black & white view's swatches split lightness into, each 10 wide. */
const SHADE_STEP_COUNT = 10;

/** The gray steps, 0 (black, lightness under 10) to 9 (white, 90 and up). */
export const SHADE_STEPS = Array.from({ length: SHADE_STEP_COUNT }, (_, step) => step);

/** The step a CIELAB lightness from 0 to 100 falls in. */
export function shadeStepOf(lightness: number): number {
  return Math.min(SHADE_STEP_COUNT - 1, Math.max(0, Math.floor(lightness / 10)));
}

/** A step's lightness range, such as "30–40". */
export function shadeStepLabel(step: number): string {
  return `Lightness ${step * 10}–${step * 10 + 10}`;
}

/**
 * The gray at the middle of a step's lightness, as a CSS color: CIELAB lightness turned into
 * relative luminance, then into sRGB.
 */
export function shadeStepGray(step: number): string {
  const lightness = step * 10 + 5;
  const f = (lightness + 16) / 116;
  const luminance = lightness > 8 ? f ** 3 : lightness / 903.3;
  const srgb = luminance <= 0.0031308 ? 12.92 * luminance : 1.055 * luminance ** (1 / 2.4) - 0.055;
  const channel = Math.round(srgb * 255);
  return `rgb(${channel} ${channel} ${channel})`;
}

/** The `?shade=` from the URL, when it's one of the steps. */
export function parseShadeStep(value: unknown): number | undefined {
  const step = Number(value);
  return SHADE_STEPS.includes(step) ? step : undefined;
}
