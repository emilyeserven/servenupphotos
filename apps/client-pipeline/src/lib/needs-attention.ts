import type { SocialPhoto } from "@/api/publish";
import { isCasual } from "@/lib/drafts";
import { currentData } from "@/lib/social-schedule";

/** How many days of Instagram posts in a row from today the queue should have, at least. */
export const INSTAGRAM_DAYS_WANTED = 7;

/** One of the problems the Needs Attention card looks for in the photo files. */
export type PhotoProblem = "noGps" | "noColors" | "noPlaces" | "untagged" | "noGenres" | "noAlbums";

/** How soon a problem should be fixed, which the card sorts its rows by. */
export type Urgency = "high" | "medium" | "low";

/** How urgent the Instagram queue running short is. */
export const INSTAGRAM_URGENCY: Urgency = "medium";

/** How urgent a hand-marked trip line out of date with its day's photos is: the map draws it wrong. */
export const TRIP_LINES_URGENCY: Urgency = "high";

/** Each photo problem's urgency. */
export const URGENCY: Record<PhotoProblem, Urgency> = {
  noGps: "high",
  noColors: "high",
  noPlaces: "medium",
  untagged: "low",
  noGenres: "low",
  noAlbums: "low",
};

/** The photos with one problem: how many there are, and the first one's path. */
export interface ProblemCount {
  problem: PhotoProblem;
  count: number;
  /** The first such photo's path, by path, for a link that opens it. */
  first: string;
}

type PhotoData = Record<string, unknown>;

/** Whether the field is missing or an empty list. */
function isEmptyList(data: PhotoData, field: string): boolean {
  const value = data[field];
  return !Array.isArray(value) || value.length === 0;
}

function isText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** Whether the photo is marked as having no GPS position on purpose, such as a studio photo. */
function isMarkedNoGps(data: PhotoData): boolean {
  return data.noGps === true;
}

/** Whether the photo has its own GPS position: a custom one written on the Photo page, or its EXIF one. */
function hasOwnGps(data: PhotoData): boolean {
  return isText(data.customGpsPosition) || isText(data.gpsPosition);
}

/** Whether the photo has no GPS position of its own and isn't marked as going without one. */
function hasNoGps(data: PhotoData): boolean {
  return !hasOwnGps(data) && !isMarkedNoGps(data);
}

/**
 * Whether no place row has an ID, as Bulk Places counts a photo without places. A photo without GPS
 * is counted in that row instead, as the more serious problem, and one marked as going without GPS
 * is left out.
 */
function hasNoPlaces(data: PhotoData): boolean {
  const places = Array.isArray(data.places) ? data.places : [];
  const placeless = !places.some((row) => typeof (row as { id?: unknown } | null)?.id === "string");
  return placeless && hasOwnGps(data);
}

/** Whether the colors are missing, or were saved before `peakChroma`, as Update Data › Colors reads them. */
function hasNoColors(data: PhotoData): boolean {
  const colors = data.colors as { peakChroma?: unknown } | null | undefined;
  return colors?.peakChroma === undefined;
}

/** Each problem's test of a photo's JSON, most urgent first, in the order the card lists them. */
const TESTS: Record<PhotoProblem, (data: PhotoData) => boolean> = {
  noGps: hasNoGps,
  noColors: hasNoColors,
  noPlaces: hasNoPlaces,
  untagged: (data) => isEmptyList(data, "tags"),
  noGenres: (data) => isEmptyList(data, "genres"),
  noAlbums: (data) => isEmptyList(data, "albums"),
};

/**
 * Every photo file as the next Commit will have it, by path, without the removed ones or casual
 * photos, which only show with their place on a Trip page and need none of the rest.
 */
function currentPhotos(photos: SocialPhoto[], changed: Map<string, unknown>) {
  return photos
    .map((photo) => ({ path: photo.path, data: currentData(photo, changed) as PhotoData | null }))
    .filter((photo): photo is { path: string; data: PhotoData } => photo.data !== null)
    .filter((photo) => !isCasual(photo.data))
    .toSorted((a, b) => a.path.localeCompare(b.path, "en"));
}

/**
 * The problems at least one photo file has, with how many photos have each, counting the changes
 * not committed yet (changed, by path), as the pages that fix them count them.
 */
export function photoProblems(
  photos: SocialPhoto[],
  changed: Map<string, unknown>,
): ProblemCount[] {
  const current = currentPhotos(photos, changed);
  return Object.entries(TESTS).flatMap(([problem, test]) => {
    const found = current.filter((photo) => test(photo.data));
    const [first] = found;
    if (!first) return [];
    return [{ problem: problem as PhotoProblem, count: found.length, first: first.path }];
  });
}

/** How many more photos the Instagram queue needs to last INSTAGRAM_DAYS_WANTED days; 0 when it does. */
export function instagramShortBy(daysLeft: number): number {
  return Math.max(0, INSTAGRAM_DAYS_WANTED - daysLeft);
}
