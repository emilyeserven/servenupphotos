import { seededRandom } from "@/lib/seeded-random";

/** How many rows of photos the Lucky page can draw, picked in its dropdown. */
export const LUCKY_ROWS = [1, 2, 3, 4, 6, 8] as const;

/** How many rows of photos the Lucky page draws. */
export type LuckyRows = (typeof LUCKY_ROWS)[number];

/** How many rows the Lucky page draws when the URL doesn't say. */
export const DEFAULT_LUCKY_ROWS: LuckyRows = 3;

/** The Lucky page's `?rows=` from the URL, left out when it isn't one of the choices or is the default. */
export function parseLuckyRows(rows: unknown): { rows?: LuckyRows } {
  const known = LUCKY_ROWS.find((choice) => choice === Number(rows));
  return known && known !== DEFAULT_LUCKY_ROWS ? { rows: known } : {};
}

/** One choice in the Lucky page's dropdown: a number of rows and how many photos they hold. */
export interface LuckyChoice {
  rows: LuckyRows;
  photos: number;
}

/** A new seed for a draw, so each Shuffle (and each visit) picks different photos. */
export function newLuckySeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * The pool in a random order, picked by the seed. The same seed and pool always give the same
 * order, so the draw stays put while the photo viewer is open, and a new seed gives a new one.
 */
export function shuffled<T>(pool: readonly T[], seed: number): T[] {
  const random = seededRandom(seed);
  const rest = [...pool];
  const drawn: T[] = [];
  while (rest.length > 0) {
    const index = Math.floor(random() * rest.length);
    drawn.push(...rest.splice(index, 1));
  }
  return drawn;
}
