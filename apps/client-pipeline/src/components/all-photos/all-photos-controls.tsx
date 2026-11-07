import { useNavigate } from "@tanstack/react-router";
import type { AllPhotosEntry, PhotoKind } from "@/components/all-photos/all-photos-files";
import type { AllPhotosSearch } from "@/components/all-photos/all-photos-search";
import {
  type AllPhotosSort,
  ORDER_LABELS,
  SORT_OPTIONS,
  type SortOrder,
} from "@/components/all-photos/all-photos-sort";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import { Card, CardContent } from "@/components/ui/card";

/** Changes some of the All Photos page's search params, keeping the page where it's scrolled to. */
export function useSetSearch() {
  const navigate = useNavigate({ from: "/all-photos" });
  return (next: Partial<AllPhotosSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });
}

const SHOW_CHOICES: ToggleChoices<"shown"> = [
  [undefined, "Hidden"],
  ["shown", "Shown"],
];

const SORT_CHOICES: ToggleChoices<AllPhotosSort> = SORT_OPTIONS.map(({ sort, label }) => [
  sort === "taken" ? undefined : sort,
  label,
]);

/** How many entries are of the kind. */
function countKind(entries: AllPhotosEntry[], kind: PhotoKind): number {
  return entries.filter((entry) => entry.kind === kind).length;
}

/**
 * The page's toggles: whether the drafts and the Undecided photos are shown alongside the
 * published ones, each with how many there are, and the sort with which way it runs.
 */
export function AllPhotosControls({
  entries,
  search,
  sort,
  order,
}: {
  entries: AllPhotosEntry[];
  search: AllPhotosSearch;
  sort: AllPhotosSort;
  order: SortOrder;
}) {
  const setSearch = useSetSearch();
  const [asc, desc] = ORDER_LABELS[sort];
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4 text-sm">
        <p className="text-muted-foreground">
          {countKind(entries, "published")} published, {countKind(entries, "draft")} drafts and{" "}
          {countKind(entries, "undecided")} Undecided.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterToggle
            label="Drafts"
            choices={SHOW_CHOICES}
            choice={search.drafts && "shown"}
            onChange={(choice) => void setSearch({ drafts: choice && true })}
          />
          <FilterToggle
            label="Undecided"
            choices={SHOW_CHOICES}
            choice={search.undecided && "shown"}
            onChange={(choice) => void setSearch({ undecided: choice && true })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterToggle
            label="Sort"
            choices={SORT_CHOICES}
            choice={search.sort}
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
        </div>
      </CardContent>
    </Card>
  );
}
