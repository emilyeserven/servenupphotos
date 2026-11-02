import { useNavigate } from "@tanstack/react-router";
import type { InFlightFileRead } from "@/api/photos";
import { bySaved, byFileName } from "@/components/draft-sort";
import { sortGallery } from "@/components/gallery/gallery-sort";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import { savedTitle, untitledFirst } from "@/lib/untitled-photos";

/**
 * What the photos on Photos in Flight are sorted by besides untitled first: "taken", when each
 * photo was taken, newest first; "added", when it went on the portfolio, most recent first;
 * "saved", the order their files were made, newest first; "title", by title from A to Z; or
 * "file", by the JSON file's name.
 */
export type InFlightSort = "taken" | "added" | "saved" | "title" | "file";

const SORT_CHOICES: ToggleChoices<InFlightSort> = [
  [undefined, "Untitled first"],
  ["taken", "Date taken"],
  ["added", "Date added"],
  ["saved", "Recently saved"],
  ["title", "Title"],
  ["file", "File name"],
];

/** The page's `?sort=` search param, or undefined (untitled first) for anything else. */
export function parseInFlightSort(search: Record<string, unknown>): InFlightSort | undefined {
  return SORT_CHOICES.find(([sort]) => sort !== undefined && sort === search.sort)?.[0];
}

/** files by title from A to Z, with numbers in order, then the untitled ones by file name. */
function byTitle<T extends InFlightFileRead>(files: T[]): T[] {
  const byName = byFileName(files);
  const titled = byName.filter((file) => savedTitle(file));
  const untitled = byName.filter((file) => !savedTitle(file));
  const sorted = titled.toSorted((a, b) =>
    (savedTitle(a) ?? "").localeCompare(savedTitle(b) ?? "", undefined, { numeric: true }),
  );
  return [...sorted, ...untitled];
}

/** Each of the sorts besides untitled first. */
const SORTS: Record<InFlightSort, <T extends InFlightFileRead>(files: T[]) => T[]> = {
  taken: (files) => sortGallery(files, undefined),
  added: (files) => sortGallery(files, "added"),
  saved: bySaved,
  title: byTitle,
  file: byFileName,
};

/**
 * files in the page's sort: the untitled ones first, each part in the pull request's order, when
 * none is chosen.
 */
export function sortInFlight<T extends InFlightFileRead>(
  files: T[],
  sort: InFlightSort | undefined,
): T[] {
  return sort ? SORTS[sort](files) : untitledFirst(files);
}

/** The Sort buttons for the photos in flight's filter bar. */
export function InFlightSortToggle({ sort }: { sort?: InFlightSort }) {
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
