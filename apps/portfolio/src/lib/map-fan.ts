import type { PlacedPhoto } from "@/lib/map-photos";

/** The zoom from which photos sharing one spot are spread out around it. */
export const FAN_MIN_ZOOM = 16;

/** The most photos at one spot that are spread out from a group; a busier spot stays one group. */
export const FAN_MAX_PHOTOS = 12;

/** How far apart the centers of spread out photos are, in pixels: a marker and a gap. */
const FAN_SPACING = 52;

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

/**
 * Where each of `count` photos at one spot goes: none for one, which stays on it, otherwise evenly around a circle
 * starting at the top, wide enough that their markers don't overlap.
 */
function circleOffsets(count: number): FanOffset[] {
  if (count < 2) return [];
  const radius = FAN_SPACING / (2 * Math.sin(Math.PI / count));
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    return [Math.round(radius * Math.cos(angle)), Math.round(radius * Math.sin(angle))];
  });
}

/**
 * How far to move each photo's marker by its ID, so photos at the same spot sit in a circle around
 * it, oldest at the top and going clockwise, instead of on top of one another.
 */
export function fanOffsets(photos: PlacedPhoto[]): Map<number, FanOffset> {
  const spots = new Map<string, PlacedPhoto[]>();
  for (const photo of photos)
    spots.set(spotOf(photo), [...(spots.get(spotOf(photo)) ?? []), photo]);
  const offsets = new Map<number, FanOffset>();
  for (const atSpot of spots.values()) {
    const oldestFirst = atSpot.toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
    const circle = circleOffsets(oldestFirst.length);
    oldestFirst.forEach((photo, index) => {
      const offset = circle[index];
      if (offset) offsets.set(photo.id, offset);
    });
  }
  return offsets;
}
