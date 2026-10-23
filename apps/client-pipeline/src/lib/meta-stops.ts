import type { MetaField } from "@/api/metainfo";

/** Exposures from 1/8000 s to 30 s, a stop apart, in seconds. */
const EXPOSURES = [8000, 4000, 2000, 1000, 500, 250, 125, 60, 30, 15, 8, 4, 2].map((d) => 1 / d);

/**
 * The common values of each ranged field, a stop or so apart, so the range slider reaches past the
 * values the photos have: a group can cover settings no photo uses yet.
 */
export const STANDARD_STOPS: Partial<Record<MetaField, number[]>> = {
  focalLength: [8, 10, 12, 14, 16, 20, 24, 28, 35, 50, 70, 85, 100, 135, 200, 300, 400, 600, 800],
  aperture: [1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32],
  exposure: [...EXPOSURES, 1, 2, 4, 8, 15, 30],
  iso: [50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200, 102400],
};
