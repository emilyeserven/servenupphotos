import { useNavigate } from "@tanstack/react-router";
import type { PublishedFile } from "@/api/photos";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import { savedString } from "@/components/gallery/published-file";

/**
 * What the Gallery is sorted by besides when each photo was taken, newest first: "added", when
 * it went on the portfolio, most recent first.
 */
export type GallerySort = "added";

const SORT_CHOICES: ToggleChoices<GallerySort> = [
  [undefined, "Date taken"],
  ["added", "Date added"],
];

/** The Gallery's `?sort=` search param, or undefined (date taken) for anything else. */
export function parseGallerySort(search: Record<string, unknown>): GallerySort | undefined {
  return search.sort === "added" ? "added" : undefined;
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
 * files in the Gallery's sort: by when each photo was taken, newest first, or by when it was
 * added to the portfolio, most recent first, then the ones without a date added by when they
 * were taken.
 */
export function sortGallery(
  files: PublishedFile[],
  sort: GallerySort | undefined,
): PublishedFile[] {
  const byTaken = latestFirst(files, "createDate");
  if (sort !== "added") return byTaken;
  const added = byTaken.filter((file) => savedString(file, "addedDate"));
  const undated = byTaken.filter((file) => !savedString(file, "addedDate"));
  return [...latestFirst(added, "addedDate"), ...undated];
}

/** The Gallery's Date taken and Date added buttons, for its filter bar. */
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
