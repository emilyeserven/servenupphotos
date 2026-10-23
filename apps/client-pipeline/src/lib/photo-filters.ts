import { titleOf } from "@/lib/drafts";

/** Whether a filter keeps the photos that have the thing, or the ones without it. */
export type FilterChoice = "with" | "without";

/** The things the Photos in Flight page can filter photos by. */
export type FilterKey = "title" | "place" | "gps" | "albums" | "tags" | "reEdit";

/** The filters chosen, by what they filter on; a thing left out isn't filtered on. */
export type PhotoFilters = Partial<Record<FilterKey, FilterChoice>>;

type PhotoData = Record<string, unknown>;

/** Whether `value` is a string with more than spaces in it. */
function isText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** Whether `value` is an array with at least one entry. */
function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasPlace(data: PhotoData): boolean {
  return hasEntries(data.places) || isText(data.placeName);
}

function hasGps(data: PhotoData): boolean {
  return isText(data.customGpsPosition) || isText(data.gpsPosition);
}

/** Each filter, in the order the page shows them, with its label and how it reads a photo's JSON. */
export const PHOTO_FILTERS: { key: FilterKey; label: string; has: (data: PhotoData) => boolean }[] =
  [
    { key: "title", label: "Title", has: (data) => titleOf(data) !== undefined },
    { key: "place", label: "Place", has: hasPlace },
    { key: "gps", label: "GPS position", has: hasGps },
    { key: "albums", label: "Albums", has: (data) => hasEntries(data.albums) },
    { key: "tags", label: "Tags", has: (data) => hasEntries(data.tags) },
    { key: "reEdit", label: "Re-edit mark", has: (data) => Boolean(data.reEdit) },
  ];

function isChoice(value: unknown): value is FilterChoice {
  return value === "with" || value === "without";
}

/** The filters in a page's search params, such as `?title=without&place=with`, ignoring anything else. */
export function parseFilters(search: Record<string, unknown>): PhotoFilters {
  const filters: PhotoFilters = {};
  for (const { key } of PHOTO_FILTERS) {
    const value = search[key];
    if (isChoice(value)) filters[key] = value;
  }
  return filters;
}

/** How many filters are chosen. */
export function filterCount(filters: PhotoFilters): number {
  return Object.values(filters).filter(isChoice).length;
}

/**
 * Whether a photo's JSON passes every chosen filter. A photo whose JSON couldn't be read only
 * passes when no filter is chosen.
 */
export function matchesFilters(data: unknown, filters: PhotoFilters): boolean {
  if (filterCount(filters) === 0) return true;
  if (typeof data !== "object" || data === null) return false;
  return PHOTO_FILTERS.every(({ key, has }) => passes(filters[key], has(data as PhotoData)));
}

function passes(choice: FilterChoice | undefined, has: boolean): boolean {
  if (!choice) return true;
  return has === (choice === "with");
}
