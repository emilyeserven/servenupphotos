import { useNavigate } from "@tanstack/react-router";
import type { PublishedFile } from "@/api/photos";
import { sortGallery } from "@/components/gallery/gallery-sort";
import { fileName } from "@/components/gallery/published-file";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";

/**
 * What the drafts on Photos in Flight are sorted by besides their file name: "taken", when each
 * photo was taken, newest first, or "saved", the order their files were made, newest first.
 */
export type DraftSort = "taken" | "saved";

const SORT_CHOICES: ToggleChoices<DraftSort> = [
  [undefined, "File name"],
  ["taken", "Date taken"],
  ["saved", "Recently saved"],
];

/** The page's `?draftSort=` search param, or undefined (file name) for anything else. */
export function parseDraftSort(search: Record<string, unknown>): DraftSort | undefined {
  return SORT_CHOICES.find(([sort]) => sort !== undefined && sort === search.draftSort)?.[0];
}

/** files by their JSON file's name, with numbers in order, so "dsc-9" comes before "dsc-10". */
function byFileName(files: PublishedFile[]): PublishedFile[] {
  return files.toSorted((a, b) =>
    fileName(a.path).localeCompare(fileName(b.path), undefined, { numeric: true }),
  );
}

/** The photo's ID, which grows with each file made; -1 without one. */
function photoId(file: PublishedFile): number {
  const id = (file.data as Record<string, unknown> | undefined)?.id;
  return typeof id === "number" ? id : -1;
}

/**
 * files by when they were saved, newest first. Drafts have no date added, so this goes by their
 * photo ID, given out in order as each file is made.
 */
function bySaved(files: PublishedFile[]): PublishedFile[] {
  return byFileName(files).toSorted((a, b) => photoId(b) - photoId(a));
}

const SORTS: Record<DraftSort, (files: PublishedFile[]) => PublishedFile[]> = {
  taken: (files) => sortGallery(files, undefined),
  saved: bySaved,
};

/** files in the drafts' sort: by file name, by when they were taken, or by when they were saved. */
export function sortDrafts(files: PublishedFile[], sort: DraftSort | undefined): PublishedFile[] {
  return sort ? SORTS[sort](files) : byFileName(files);
}

/** The drafts' File name, Date taken and Recently saved buttons, for their filter bar. */
export function DraftSortToggle({ sort }: { sort?: DraftSort }) {
  const navigate = useNavigate();
  return (
    <FilterToggle
      label="Sort"
      choice={sort}
      choices={SORT_CHOICES}
      onChange={(next) =>
        void navigate({
          to: ".",
          search: (prev: Record<string, unknown>) => ({ ...prev, draftSort: next }),
          replace: true,
        })
      }
    />
  );
}
