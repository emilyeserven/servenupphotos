import { exposureSeconds, type RangeKey } from "@portfolio/lib/camera-filters";

/** A number kept between the lowest and highest it can be. */
function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * How wide a lens at the focal length sees, in degrees, across a full-frame (36mm wide) sensor:
 * about 84° at 20mm and 10° at 200mm.
 */
export function viewAngle(focalLength: number): number {
  const degrees = (2 * Math.atan(36 / (2 * focalLength)) * 180) / Math.PI;
  return clamp(degrees, 4, 130);
}

/**
 * How open the aperture is at the f-number, from 0 (shut) to 1 (wide open at f/1.2 or lower):
 * the opening's width halves each time the f-number doubles.
 */
export function apertureOpening(fNumber: number): number {
  return clamp(1.2 / fNumber, 0.06, 1);
}

/** The shortest and longest exposures the dial shows, in seconds. */
const SHORTEST = 1 / 8000;
const LONGEST = 30;

/**
 * How long the exposure is, from 0 (1/8000s or faster) to 1 (30s or longer), on a scale where each
 * doubling of the time is the same step, as photographers count stops.
 */
export function exposureShare(exposure: string): number {
  const seconds = exposureSeconds(exposure) ?? SHORTEST;
  return clamp(Math.log2(seconds / SHORTEST) / Math.log2(LONGEST / SHORTEST), 0, 1);
}

/** How many grains of noise to draw at the ISO: a few at ISO 100, more for every doubling. */
export function grainCount(iso: number): number {
  return Math.round(clamp(3 + 7 * Math.log2(iso / 100), 0, 70));
}

/** What each setting's graphic shows, and what its low and high ends mean for a photo. */
export const SETTING_NOTES: Record<RangeKey, { low: string; high: string; text: string }> = {
  focalLength: {
    low: "Wider view",
    high: "Zoomed in",
    text: "A short focal length fits more of the scene in; a long one zooms in on less of it.",
  },
  aperture: {
    low: "Wide open",
    high: "Stopped down",
    text: "A low f-number opens the lens wide, letting in more light and blurring the background; a high one keeps more in focus.",
  },
  exposure: {
    low: "Fast",
    high: "Slow",
    text: "A fast shutter freezes motion; a slow one lets in more light and blurs anything moving.",
  },
  iso: {
    low: "Clean",
    high: "Grainy",
    text: "A higher ISO brightens a dark scene, at the cost of more grain.",
  },
};
