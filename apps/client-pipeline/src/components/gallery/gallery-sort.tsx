import { useNavigate } from "@tanstack/react-router";
import type { PublishedFile } from "@/api/photos";
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

/** files by the saved field, latest first, then ones without it by path. */
function latestFirst(files: PublishedFile[], field: string): PublishedFile[] {
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
function timeOfDay(file: PublishedFile): string | undefined {
  const date = savedString(file, "customCreateDate") ?? savedString(file, "createDate");
  return /^\d{4}:\d{2}:\d{2} (\d{2}:\d{2}:\d{2})/.exec(date ?? "")?.[1];
}

/** files, given newest first, by when they went on the portfolio, then the ones without a date added. */
function byAdded(byTaken: PublishedFile[]): PublishedFile[] {
  const added = byTaken.filter((file) => savedString(file, "addedDate"));
  const undated = byTaken.filter((file) => !savedString(file, "addedDate"));
  return [...latestFirst(added, "addedDate"), ...undated];
}

/**
 * files, given newest first, by the time of day they were taken, from just after midnight to just
 * before, then the ones without a time, newest first.
 */
function byTimeOfDay(byTaken: PublishedFile[]): PublishedFile[] {
  const timed = byTaken.filter((file) => timeOfDay(file));
  const untimed = byTaken.filter((file) => !timeOfDay(file));
  const sorted = timed.toSorted((a, b) => (timeOfDay(a) ?? "").localeCompare(timeOfDay(b) ?? ""));
  return [...sorted, ...untimed];
}

/** Each of the Gallery's sorts besides date taken, given the files newest first. */
const SORTS: Record<GallerySort, (byTaken: PublishedFile[]) => PublishedFile[]> = {
  added: byAdded,
  time: byTimeOfDay,
};

/**
 * files in the Gallery's sort: by when each photo was taken, newest first, by when it was added
 * to the portfolio, most recent first, then the ones without a date added by when they were
 * taken, or by the time of day it was taken, earliest first.
 */
export function sortGallery(
  files: PublishedFile[],
  sort: GallerySort | undefined,
): PublishedFile[] {
  const byTaken = latestFirst(files, "createDate");
  return sort ? SORTS[sort](byTaken) : byTaken;
}

/** The Gallery's Date taken, Date added and Time of day buttons, for its filter bar. */
export function GallerySortToggle({ sort }: { sort?: GallerySort }) {
  const navigate = useNavigate({ from: "/gallery" });
  return (
    <FilterToggle
      label="Sort"
      choice={sort}
      choices={SORT_CHOICES}
      onChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, sort: next }), replace: true })
      }
    />
  );
}
