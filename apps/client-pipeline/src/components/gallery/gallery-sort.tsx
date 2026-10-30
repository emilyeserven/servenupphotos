import { useNavigate, useSearch } from "@tanstack/react-router";
import type { InFlightFileRead } from "@/api/photos";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import { savedString } from "@/components/gallery/published-file";

/**
 * What the Gallery is sorted by besides when each photo was taken, newest first: "added", when
 * it went on the portfolio, most recent first, or "time", the time of day it was taken, earliest
 * first.
 */
export type GallerySort = "added" | "time";

const SORT_CHOICES: ToggleChoices<GallerySort> = [
  [undefined, "Date taken"],
  ["added", "Date added"],
  ["time", "Time of day"],
];

/** The Gallery's `?sort=` search param, or undefined (date taken) for anything else. */
export function parseGallerySort(search: Record<string, unknown>): GallerySort | undefined {
  return SORT_CHOICES.find(([sort]) => sort !== undefined && sort === search.sort)?.[0];
}

/** The `?sort=` of the page it's on, such as the Gallery or an album's Add photos modal. */
export function useGallerySort(): GallerySort | undefined {
  return useSearch({ strict: false, select: parseGallerySort });
}

/** files by the saved field, latest first, then ones without it by path. */
function latestFirst<T extends InFlightFileRead>(files: T[], field: string): T[] {
  return files.toSorted((a, b) => {
    const da = savedString(a, field) ?? "";
    const db = savedString(b, field) ?? "";
    if (da !== db) return db.localeCompare(da);
    return a.path.localeCompare(b.path);
  });
}

/**
 * The time of day the photo was taken, as its custom date or else its EXIF date writes it, such
 * as "18:42:05" for "2025:10:03 18:42:05"; undefined when it has neither.
 */
function timeOfDay(file: InFlightFileRead): string | undefined {
  const date = savedString(file, "customCreateDate") ?? savedString(file, "createDate");
  return /^\d{4}:\d{2}:\d{2} (\d{2}:\d{2}:\d{2})/.exec(date ?? "")?.[1];
}

/** files, given newest first, by when they went on the portfolio, then the ones without a date added. */
function byAdded<T extends InFlightFileRead>(byTaken: T[]): T[] {
  const added = byTaken.filter((file) => savedString(file, "addedDate"));
  const undated = byTaken.filter((file) => !savedString(file, "addedDate"));
  return [...latestFirst(added, "addedDate"), ...undated];
}

/**
 * files, given newest first, by the time of day they were taken, from just after midnight to just
 * before, then the ones without a time, newest first.
 */
function byTimeOfDay<T extends InFlightFileRead>(byTaken: T[]): T[] {
  const timed = byTaken.filter((file) => timeOfDay(file));
  const untimed = byTaken.filter((file) => !timeOfDay(file));
  const sorted = timed.toSorted((a, b) => (timeOfDay(a) ?? "").localeCompare(timeOfDay(b) ?? ""));
  return [...sorted, ...untimed];
}

/** Each of the Gallery's sorts besides date taken, given the files newest first. */
const SORTS: Record<GallerySort, <T extends InFlightFileRead>(byTaken: T[]) => T[]> = {
  added: byAdded,
  time: byTimeOfDay,
};

/**
 * files in the Gallery's sort: by when each photo was taken, newest first, by when it was added
 * to the portfolio, most recent first, then the ones without a date added by when they were
 * taken, or by the time of day it was taken, earliest first.
 */
export function sortGallery<T extends InFlightFileRead>(
  files: T[],
  sort: GallerySort | undefined,
): T[] {
  const byTaken = latestFirst(files, "createDate");
  return sort ? SORTS[sort](byTaken) : byTaken;
}

/** The Date taken, Date added and Time of day buttons, for the filter bar of the page it's on. */
export function GallerySortToggle({ sort }: { sort?: GallerySort }) {
  const navigate = useNavigate();
  return (
    <FilterToggle
      label="Sort"
      choice={sort}
      choices={SORT_CHOICES}
      onChange={(next) =>
        void navigate({
          to: ".",
          search: (prev: Record<string, unknown>) => ({ ...prev, sort: next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
