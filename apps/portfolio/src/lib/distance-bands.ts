import { distanceKm, type Point } from "@/lib/distance";
import type { Photo } from "@/lib/photos";

/** One of the Grid's Distance groups: its heading and its photos, in the sort's order. */
export interface DistanceBand<T extends Photo> {
  /** The group's heading, such as "10 to 100 km". */
  label: string;
  photos: T[];
}

/** Where each group starts, in km, with its heading; each runs to the next one's start. */
const BANDS: readonly (readonly [number, string])[] = [
  [0, "Under 1 km"],
  [1, "1 to 10 km"],
  [10, "10 to 100 km"],
  [100, "100 to 1,000 km"],
  [1000, "1,000 km and farther"],
];

/** The heading of the photos the map can't place, which come last. */
const NO_POSITION_BAND = "No location";

/** The heading of the group a photo goes in, by how far from `from` the map places it. */
function bandOf(photo: Photo, from: Point): string {
  if (photo.latitude === null || photo.longitude === null) return NO_POSITION_BAND;
  const km = distanceKm(from, { latitude: photo.latitude, longitude: photo.longitude });
  return BANDS.findLast(([start]) => km >= start)![1];
}

/**
 * The photos, already sorted by Distance either way round, split into groups of nearby distances
 * (under 1 km, 1 to 10 km, and so on, ten times farther each), keeping their order. Photos the map
 * can't place make a last group, "No location".
 */
export function distanceBands<T extends Photo>(sorted: T[], from: Point): DistanceBand<T>[] {
  const bands: DistanceBand<T>[] = [];
  for (const photo of sorted) {
    const label = bandOf(photo, from);
    const last = bands.at(-1);
    if (last?.label === label) last.photos.push(photo);
    else bands.push({ label, photos: [photo] });
  }
  return bands;
}
