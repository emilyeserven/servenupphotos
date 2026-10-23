import type { PlacedPhoto } from "@/lib/map-photos";

/** The zoom from which photos sharing one spot are spread out around it. */
export const FAN_MIN_ZOOM = 16;

/** The most photos at one spot that are spread out from a group; a busier spot stays one group. */
export const FAN_MAX_PHOTOS = 12;

/**
 * How far apart spread out photos are at least, in pixels, across or down: a marker and a gap. Two
 * square markers overlap only when they're closer than a marker's width both across and down.
 */
const FAN_SPACING = 50;

/** How much further out each failed try may land, in pixels, so a crowded spot still finds room. */
const FAN_GROWTH = 2;

/** How far a photo's marker is moved from its spot, in pixels, as [right, down]. */
export type FanOffset = [number, number];

/** Where on the map a photo is, as one string, so photos at the same spot share it. */
function spotOf(photo: PlacedPhoto): string {
  return `${photo.longitude},${photo.latitude}`;
}

/** Whether every photo is at the same spot, as photos placed at one of their places are. */
export function atOneSpot(photos: PlacedPhoto[]): boolean {
  return new Set(photos.map(spotOf)).size === 1;
}

/** A random number generator that gives the same numbers for the same seed, from 0 up to 1. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether a marker at `offset` is at least FAN_SPACING across or down from each placed one. */
function hasRoom(offset: FanOffset, placed: FanOffset[]): boolean {
  return placed.every(
    ([x, y]) => Math.max(Math.abs(offset[0] - x), Math.abs(offset[1] - y)) >= FAN_SPACING,
  );
}

/**
 * A random spot for the next marker that keeps clear of the placed ones. Each try may land a little
 * further from the middle than the last, so the markers stay close together without overlapping.
 */
function nextOffset(random: () => number, placed: FanOffset[]): FanOffset {
  for (let reach = FAN_SPACING / 2; ; reach += FAN_GROWTH) {
    const angle = random() * 2 * Math.PI;
    const distance = Math.sqrt(random()) * reach;
    const offset: FanOffset = [
      Math.round(distance * Math.cos(angle)),
      Math.round(distance * Math.sin(angle)),
    ];
    if (hasRoom(offset, placed)) return offset;
  }
}

/**
 * Where each of `count` photos at one spot goes: none for one, which stays on it, otherwise loosely
 * scattered around it without overlapping. The same seed always scatters them the same way, so
 * they don't jump about as the map moves.
 */
function scatterOffsets(count: number, seed: number): FanOffset[] {
  if (count < 2) return [];
  const random = seededRandom(seed);
  const placed: FanOffset[] = [];
  while (placed.length < count) placed.push(nextOffset(random, placed));
  return placed;
}

/** The photos at each spot. */
function bySpot(photos: PlacedPhoto[]): PlacedPhoto[][] {
  const spots = new Map<string, PlacedPhoto[]>();
  for (const photo of photos)
    spots.set(spotOf(photo), [...(spots.get(spotOf(photo)) ?? []), photo]);
  return [...spots.values()];
}

/** Scatters the photos at one spot, seeded by the oldest's ID, putting their offsets in `offsets`. */
function scatterSpot(atSpot: PlacedPhoto[], offsets: Map<number, FanOffset>) {
  const oldestFirst = atSpot.toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  const scatter = scatterOffsets(oldestFirst.length, oldestFirst[0]?.id ?? 0);
  scatter.forEach((offset, index) => {
    const photo = oldestFirst[index];
    if (photo) offsets.set(photo.id, offset);
  });
}

/**
 * How far to move each photo's marker by its ID, so photos at the same spot are scattered around
 * it, the oldest nearest the middle, instead of on top of one another.
 */
export function fanOffsets(photos: PlacedPhoto[]): Map<number, FanOffset> {
  const offsets = new Map<number, FanOffset>();
  for (const atSpot of bySpot(photos)) scatterSpot(atSpot, offsets);
  return offsets;
}
