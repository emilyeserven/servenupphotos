import { seededRandom } from "@/lib/seeded-random";

/** How many photos the Grid's Lucky view can draw at once, picked in its dropdown. */
export const LUCKY_COUNTS = [1, 6, 12, 24, 48] as const;

/** How many photos the Lucky view draws. */
export type LuckyCount = (typeof LUCKY_COUNTS)[number];

/** How many photos the Lucky view draws when the URL doesn't say. */
export const DEFAULT_LUCKY_COUNT: LuckyCount = 12;

/** The Lucky view's `?count=` from the URL, left out when it isn't one of the choices or is the default. */
export function parseLuckyCount(count: unknown): { count?: LuckyCount } {
  const known = LUCKY_COUNTS.find((choice) => choice === Number(count));
  return known && known !== DEFAULT_LUCKY_COUNT ? { count: known } : {};
}

/** A new seed for a draw, so each Shuffle (and each visit) picks different photos. */
export function newLuckySeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * Up to `count` photos picked at random from the pool, in the order they were picked. The same
 * seed and pool always give the same photos, so the draw stays put while the photo viewer is open,
 * and a new seed gives a new draw.
 */
export function drawLucky<T>(pool: readonly T[], seed: number, count: number): T[] {
  const random = seededRandom(seed);
  const rest = [...pool];
  const drawn: T[] = [];
  while (drawn.length < count && rest.length > 0) {
    const index = Math.floor(random() * rest.length);
    drawn.push(...rest.splice(index, 1));
  }
  return drawn;
}
