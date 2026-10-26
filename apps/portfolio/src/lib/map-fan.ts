import type { PlacedPhoto } from "@/lib/map-photos";

/** The zoom from which small groups of photos are split into photos of their own, spread apart. */
export const FAN_MIN_ZOOM = 12;

/** The zoom from which groups of up to FAN_MAX_PHOTOS photos are split apart. */
const FAN_FULL_ZOOM = 16;

/** The most photos in a group that are split apart, from FAN_FULL_ZOOM in. */
const FAN_MAX_PHOTOS = 12;

/** The most photos in a group that are split apart at FAN_MIN_ZOOM. */
const FAN_MIN_PHOTOS = 3;

/**
 * The most photos in a group that are split apart at a zoom; a bigger group stays one group
 * marker. It grows from FAN_MIN_PHOTOS at FAN_MIN_ZOOM to FAN_MAX_PHOTOS at FAN_FULL_ZOOM, so a
 * city shows its sparser photos on their own while busy neighborhoods stay grouped until closer.
 */
export function fanLimit(zoom: number): number {
  const along = Math.min(Math.max((zoom - FAN_MIN_ZOOM) / (FAN_FULL_ZOOM - FAN_MIN_ZOOM), 0), 1);
  return Math.round(FAN_MIN_PHOTOS + along * (FAN_MAX_PHOTOS - FAN_MIN_PHOTOS));
}

/** How much further out each failed try may land, in pixels, so a crowded spot still finds room. */
const FAN_GROWTH = 2;

/** A point on the screen, in pixels, as [right, down]. */
export type ScreenPoint = [number, number];

/** How far a photo's marker is moved from its spot, in pixels, as [right, down]. */
export type FanOffset = [number, number];

/** A photo and where its spot is on the screen. */
export interface PhotoOnScreen {
  photo: PlacedPhoto;
  at: ScreenPoint;
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

/**
 * Whether a marker at `point` is at least `spacing` pixels across or down from each placed one.
 * Two square markers overlap only when they're closer than a marker's width both across and down.
 */
function hasRoom(point: ScreenPoint, placed: ScreenPoint[], spacing: number): boolean {
  return placed.every(
    ([x, y]) => Math.max(Math.abs(point[0] - x), Math.abs(point[1] - y)) >= spacing,
  );
}

/**
 * Where a photo's marker goes: on its spot when there's room, otherwise a random point near it
 * that keeps clear of the placed markers. Each try may land a little further out than the last, so
 * the markers stay close to their spots without overlapping. The photo's ID seeds the tries, so it
 * lands in the same place every time.
 */
function pointNear(
  { photo, at }: PhotoOnScreen,
  placed: ScreenPoint[],
  spacing: number,
): ScreenPoint {
  if (hasRoom(at, placed, spacing)) return at;
  const random = seededRandom(photo.id);
  for (let reach = spacing; ; reach += FAN_GROWTH) {
    const angle = random() * 2 * Math.PI;
    const distance = Math.sqrt(random()) * reach;
    const point: ScreenPoint = [
      at[0] + distance * Math.cos(angle),
      at[1] + distance * Math.sin(angle),
    ];
    if (hasRoom(point, placed, spacing)) return point;
  }
}

/**
 * How far to move each photo's marker by its ID so no two markers overlap, each kept as near its
 * own spot as there's room for: photos at the same spot, or close together, are scattered loosely
 * around it. `taken` are the points other markers, such as groups, already cover, and `spacing`
 * how far apart markers are kept, in pixels: a marker and a gap. The oldest
 * photos are placed first, so they stay nearest their spots.
 */
export function fanOffsets(
  photos: PhotoOnScreen[],
  taken: ScreenPoint[],
  spacing: number,
): Map<number, FanOffset> {
  const placed = [...taken];
  const offsets = new Map<number, FanOffset>();
  const oldestFirst = photos.toSorted(
    (a, b) => a.photo.takenAt.getTime() - b.photo.takenAt.getTime() || a.photo.id - b.photo.id,
  );
  for (const onScreen of oldestFirst) {
    const point = pointNear(onScreen, placed, spacing);
    placed.push(point);
    offsets.set(onScreen.photo.id, [
      Math.round(point[0] - onScreen.at[0]),
      Math.round(point[1] - onScreen.at[1]),
    ]);
  }
  return offsets;
}
