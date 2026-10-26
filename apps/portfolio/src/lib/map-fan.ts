/** The zoom from which small groups of photos are split into photos of their own, spread apart. */
export const FAN_MIN_ZOOM = 12;

/** The zoom from which groups of up to FAN_MAX_PHOTOS photos are split apart. */
const FAN_FULL_ZOOM = 16;

/** The most photos in a group that are split apart, from FAN_FULL_ZOOM in. */
const FAN_MAX_PHOTOS = 12;

/** The most photos in a group that are split apart at FAN_MIN_ZOOM. */
const FAN_MIN_PHOTOS = 3;

/** How wide a pin is at the default size, in pixels, which the photo counts above are for. */
const FAN_DEFAULT_PIN = 44;

/** The gap kept between markers from FAN_MIN_ZOOM in, in pixels. */
const FAN_GAP = 6;

/** The zoom at and below which markers may cover up to half of one another. */
const FAN_LOOSE_ZOOM = 8;

/**
 * How far apart markers are kept at least, in pixels across or down, for pins `pin` pixels wide.
 * From FAN_MIN_ZOOM in, a pin's width and a gap, so none overlap. Zoomed out to FAN_LOOSE_ZOOM,
 * half a pin, so markers may overlap but none is more than half covered by another; in between,
 * it grows from one to the other. Two square markers this far apart across or down overlap by at
 * most `pin - spacing` that way, and not at all the other.
 */
export function fanSpacing(zoom: number, pin: number): number {
  const along = Math.min(Math.max((zoom - FAN_LOOSE_ZOOM) / (FAN_MIN_ZOOM - FAN_LOOSE_ZOOM), 0), 1);
  return pin / 2 + along * (pin / 2 + FAN_GAP);
}

/**
 * The most photos in a group that are split apart at a zoom, for pins `pin` pixels wide; a bigger
 * group stays one group marker. It grows from FAN_MIN_PHOTOS at FAN_MIN_ZOOM to
 * FAN_MAX_PHOTOS at FAN_FULL_ZOOM, so a city shows its sparser photos on their own while busy
 * neighborhoods stay grouped until closer. Bigger pins split fewer, as each takes more room and
 * would have to be moved further from its spot: the limit shrinks with the room a pin takes.
 */
export function fanLimit(zoom: number, pin: number): number {
  const along = Math.min(Math.max((zoom - FAN_MIN_ZOOM) / (FAN_FULL_ZOOM - FAN_MIN_ZOOM), 0), 1);
  const limit = FAN_MIN_PHOTOS + along * (FAN_MAX_PHOTOS - FAN_MIN_PHOTOS);
  return Math.max(1, Math.round(limit * (FAN_DEFAULT_PIN / pin) ** 2));
}

/** How much further out each failed try may land, in pixels, so a crowded spot still finds room. */
const FAN_GROWTH = 2;

/** A point on the screen, in pixels, as [right, down]. */
export type ScreenPoint = [number, number];

/** How far a marker is moved from its spot, in pixels, as [right, down]. */
export type FanOffset = [number, number];

/** A marker, a photo's or a group's, and where its spot is on the screen. */
export interface MarkerOnScreen {
  /** The marker's key, which its offset is found by. */
  key: string;
  /** A number of its own, such as its photo's ID, that seeds where it's moved to. */
  seed: number;
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
 * Where a marker goes: on its spot when there's room, otherwise a random point near it that keeps
 * clear of the placed markers. Each try may land a little further out than the last, so the
 * markers stay close to their spots without overlapping. Its seed seeds the tries, so it lands in
 * the same place every time.
 */
function pointNear(
  { seed, at }: MarkerOnScreen,
  placed: ScreenPoint[],
  spacing: number,
): ScreenPoint {
  if (hasRoom(at, placed, spacing)) return at;
  const random = seededRandom(seed);
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
 * How far to move each marker, by its key, so every two are at least `spacing` pixels apart across
 * or down, each kept as near its own spot as there's room for: markers at the same spot, or close
 * together, are scattered loosely around it. They're placed in the order given, so the first stay
 * nearest their spots.
 */
export function fanOffsets(markers: MarkerOnScreen[], spacing: number): Map<string, FanOffset> {
  const placed: ScreenPoint[] = [];
  const offsets = new Map<string, FanOffset>();
  for (const marker of markers) {
    const point = pointNear(marker, placed, spacing);
    placed.push(point);
    offsets.set(marker.key, [
      Math.round(point[0] - marker.at[0]),
      Math.round(point[1] - marker.at[1]),
    ]);
  }
  return offsets;
}
