import type { SocialPhoto } from "@/api/publish";
import { isSetAside, isUnselected, titleOf } from "@/lib/drafts";
import { currentData } from "@/lib/social-schedule";

/** How many days of Instagram posts in a row from today the queue should have, at least. */
export const INSTAGRAM_DAYS_WANTED = 7;

/** One of the problems the Needs Attention card looks for in the photo files. */
export type PhotoProblem =
  | "untitled"
  | "untagged"
  | "noGenres"
  | "noAlbums"
  | "noPlaces"
  | "noColors";

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

/** Whether no place row has an ID, as Bulk Places counts a photo without places. */
function hasNoPlaces(data: PhotoData): boolean {
  const places = Array.isArray(data.places) ? data.places : [];
  return !places.some((row) => typeof (row as { id?: unknown } | null)?.id === "string");
}

/** Whether the colors are missing, or were saved before `peakChroma`, as Update Data › Colors reads them. */
function hasNoColors(data: PhotoData): boolean {
  const colors = data.colors as { peakChroma?: unknown } | null | undefined;
  return colors?.peakChroma === undefined;
}

/** Whether the photo has no title and is waiting for one: not Undecided or unselected. */
function isUntitled(data: PhotoData): boolean {
  return titleOf(data) === undefined && !isSetAside(data) && !isUnselected(data);
}

/** Each problem's test of a photo's JSON, in the order the card lists them. */
const TESTS: Record<PhotoProblem, (data: PhotoData) => boolean> = {
  untitled: isUntitled,
  untagged: (data) => isEmptyList(data, "tags"),
  noGenres: (data) => isEmptyList(data, "genres"),
  noAlbums: (data) => isEmptyList(data, "albums"),
  noPlaces: hasNoPlaces,
  noColors: hasNoColors,
};

/** Every photo file as the next Commit will have it, by path, without the removed ones. */
function currentPhotos(photos: SocialPhoto[], changed: Map<string, unknown>) {
  return photos
    .map((photo) => ({ path: photo.path, data: currentData(photo, changed) as PhotoData | null }))
    .filter((photo): photo is { path: string; data: PhotoData } => photo.data !== null)
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
