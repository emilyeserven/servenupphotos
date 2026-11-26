import type { GeneratedPage } from "@/lib/photo-book-generated";

/** The sizes a single Places Index entry can be set to, in percent of the list's text size, and the step between them. */
export const ENTRY_SIZES = { min: 50, max: 100, step: 5 };

/** The smallest share of its size **Shrink lines to fit** shrinks an entry to, so it stays on one line. */
const MIN_FIT_SCALE = 0.8;

/** A size rounded to a step of ENTRY_SIZES and kept in its range; 100 for one that isn't a number. */
function roundedSize(size: number): number {
  const n = Math.round(size / ENTRY_SIZES.step) * ENTRY_SIZES.step;
  return Number.isFinite(n) ? Math.min(Math.max(n, ENTRY_SIZES.min), ENTRY_SIZES.max) : 100;
}

/** The entry's own text size, in percent of the list's: 100 unless it's been made smaller. */
export function entrySize(generated: Pick<GeneratedPage, "entrySizes">, key: string): number {
  const size = generated.entrySizes?.[key];
  return size === undefined ? 100 : roundedSize(size);
}

/** The entry sizes with the entry at key set to size; one at 100 left out, and none at all as absent. */
export function withEntrySize(
  sizes: Record<string, number> | undefined,
  key: string,
  size: number,
): Record<string, number> | undefined {
  return tidyEntrySizes({ ...sizes, [key]: size });
}

/** The entry sizes rounded and kept in range, those at 100 left out, and none at all as absent. */
export function tidyEntrySizes(
  sizes: Record<string, number> | undefined,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const [key, size] of Object.entries(sizes ?? {})) {
    const rounded = roundedSize(size);
    if (rounded < 100) out[key] = rounded;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * How much **Shrink lines to fit** shrinks a line that's `natural` wide on one line, in a column
 * `room` wide: 1 when it fits, the share that makes it just fit when that's no less than
 * MIN_FIT_SCALE, and null when it would need more than that, so it wraps at its size instead.
 */
export function fitScale(natural: number, room: number): number | null {
  if (natural <= room || natural <= 0) return 1;
  // A hair under the exact share, so rounding on screen doesn't wrap the last letter again.
  const scale = Math.floor((room / natural) * 1000) / 1000;
  return scale >= MIN_FIT_SCALE ? scale : null;
}

/**
 * The style of an entry's text at scale (its own size, 1 for 100%) shrunk by fit (from fitScale,
 * null when it wraps): no font size at full size, and kept on one line while it's shrunk to fit.
 */
export function entryTextStyle(
  scale: number,
  fit: number | null,
): { fontSize?: string; whiteSpace?: "nowrap" } {
  const shrink = fit ?? 1;
  const size = scale * shrink;
  return {
    ...(size === 1 ? {} : { fontSize: `${size}em` }),
    ...(shrink < 1 ? { whiteSpace: "nowrap" } : {}),
  };
}
