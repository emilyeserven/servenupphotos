import { useNavigate } from "@tanstack/react-router";
import type { GalleryFile, PhotoKind } from "@/components/gallery/gallery-files";
import { type ShowSearch, shownKinds } from "@/lib/gallery-show";
import {
  ORDER_LABELS,
  type PhotoSort,
  SORT_OPTIONS,
  type SortOrder,
} from "@/components/gallery/photo-sort";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filter-bar";
import { cn } from "@/lib/utils";

/** Changes some of the Gallery's search params, keeping the page where it's scrolled to. */
export function useSetShowSearch() {
  const navigate = useNavigate({ from: "/gallery" });
  return (next: Partial<ShowSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });
}

/** Each Show group's label and the search param that turns it on or off, in the order shown. */
const GROUPS: { kind: PhotoKind; label: string; toggle: (on: boolean) => Partial<ShowSearch> }[] = [
  {
    kind: "published",
    label: "Published",
    toggle: (on) => ({ published: on ? undefined : false }),
  },
  { kind: "draft", label: "Drafts", toggle: (on) => ({ drafts: on || undefined }) },
  { kind: "undecided", label: "Undecided", toggle: (on) => ({ undecided: on || undefined }) },
  { kind: "lowerTier", label: "Lower Tier", toggle: (on) => ({ lowerTier: on || undefined }) },
];

/** How many files are in the Show group. */
function countKind(files: GalleryFile[], kind: PhotoKind): number {
  return files.filter((file) => file.kind === kind).length;
}

/**
 * The Show group: a button for each of the published photos, drafts, Undecided and Lower Tier
 * photos, with how many of each there are, any number of them on at once. A group with no photos
 * is left out unless it's on.
 */
export function ShowToggles({ files, search }: { files: GalleryFile[]; search: ShowSearch }) {
  const setSearch = useSetShowSearch();
  const kinds = shownKinds(search);
  const groups = GROUPS.map((group) => ({ ...group, count: countKind(files, group.kind) }));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">Show</span>
      <div role="group" aria-label="Show" className="bg-background flex rounded-md border p-0.5">
        {groups
          .filter(({ kind, count }) => count > 0 || kinds[kind])
          .map(({ kind, label, toggle, count }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={kinds[kind]}
              onClick={() => void setSearch(toggle(!kinds[kind]))}
              className={cn(
                "focus-visible:ring-ring rounded px-2 py-0.5 text-xs outline-none focus-visible:ring-2",
                kinds[kind]
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="tabular-nums opacity-70">{count.toLocaleString()}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

const SORT_CHOICES: ToggleChoices<PhotoSort> = SORT_OPTIONS.map(({ sort, label }) => [
  sort === "taken" ? undefined : sort,
  label,
]);

/** The Sort buttons and the Order buttons for which way it runs; changing the sort resets the order. */
export function SortToggles({ sort, order }: { sort: PhotoSort; order: SortOrder }) {
  const setSearch = useSetShowSearch();
  const [asc, desc] = ORDER_LABELS[sort];
  return (
    <>
      <FilterToggle
        label="Sort"
        choices={SORT_CHOICES}
        choice={sort === "taken" ? undefined : sort}
        onChange={(next) => void setSearch({ sort: next, order: undefined })}
      />
      <FilterToggle<SortOrder>
        label="Order"
        choices={[
          ["asc", asc],
          ["desc", desc],
        ]}
        choice={order}
        onChange={(next) => void setSearch({ order: next })}
      />
    </>
  );
}
