import { useNavigate, useSearch } from "@tanstack/react-router";
import { FilterIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { editedData } from "@/lib/undecided";
import {
  type FilterChoice,
  type FilterKey,
  type PhotoFilters,
  PHOTO_FILTERS,
  filterCount,
  filterParam,
  matchesFilters,
  parseFilters,
} from "@/lib/photo-filters";
import { cn } from "@/lib/utils";
import { useLocalEditsStore } from "@/stores/local-edits";

/** A photo file as the filters read it. */
interface FilteredFile {
  path: string;
  data?: unknown;
  error?: string;
}

/**
 * The filters chosen on the page (Photos in Flight or the Gallery), kept in the URL so a reload
 * keeps them, and the files that pass them with the local edits made. A prefix reads a second
 * filter bar's, such as "draft" for the drafts on Photos in Flight.
 */
export function usePhotoFilters(prefix?: string) {
  const filters = useSearch({
    strict: false,
    select: (search: Record<string, unknown>) => parseFilters(search, prefix),
  });
  const edits = useLocalEditsStore((s) => s.edits);
  return {
    filters,
    filter: <T extends FilteredFile>(files: T[]): T[] =>
      files.filter((file) => matchesFilters(editedData(file, edits), filters)),
  };
}

/** Sets one filter, or clears it with undefined, or every filter under the prefix with null. */
function useSetFilter(prefix?: string) {
  const navigate = useNavigate();
  return (key: FilterKey | null, choice?: FilterChoice) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) =>
        key ? { ...prev, [filterParam(key, prefix)]: choice } : withoutFilters(prev, prefix),
      replace: true,
    });
}

/**
 * The search params a filter bar keeps filters in: each photo filter's, and the Gallery's
 * `undecided` and place filter; with a prefix, only the photo filters kept under it.
 */
function filterParams(prefix?: string): string[] {
  const params = PHOTO_FILTERS.map(({ key }) => filterParam(key, prefix));
  return prefix ? params : [...params, "undecided", "placeId", "placeGps"];
}

/** The search params with every filter under the prefix cleared. */
function withoutFilters<T extends object>(search: T, prefix?: string): T {
  return { ...search, ...Object.fromEntries(filterParams(prefix).map((key) => [key, undefined])) };
}

/**
 * The filter bar above the photos: Any, With or Without for each thing a photo can have, how many
 * photos pass, and Clear. Nothing when there are no photos to filter.
 */
export function PhotoFilterBar({
  filters,
  shown,
  total,
  children,
  hiding,
  extraChosen,
  prefix,
}: {
  filters: PhotoFilters;
  shown: number;
  total: number;
  /** More filters, after the photo filters, such as the Gallery's Undecided one. */
  children?: ReactNode;
  /** Whether something else is hiding photos, so the count shows with no filter chosen. */
  hiding?: boolean;
  /** Whether one of `children`'s filters is changed from where it starts, so Clear has work. */
  extraChosen?: boolean;
  /** The prefix its filters are kept under in the URL, as given to `usePhotoFilters`. */
  prefix?: string;
}) {
  const setFilter = useSetFilter(prefix);
  if (total === 0) return null;
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterIcon className="text-muted-foreground size-4" aria-hidden />
          {PHOTO_FILTERS.map(({ key, label }) => (
            <FilterToggle
              key={key}
              label={label}
              choice={filters[key]}
              onChange={(choice) => setFilter(key, choice)}
            />
          ))}
          {children}
        </div>
        <FilterResult
          shown={shown}
          total={total}
          chosen={isChosen(filters, extraChosen)}
          hiding={hiding}
          onClear={() => setFilter(null)}
        />
      </CardContent>
    </Card>
  );
}

/** Whether any filter is chosen: a photo filter, or one of the page's own. */
function isChosen(filters: PhotoFilters, extraChosen?: boolean): boolean {
  return filterCount(filters) > 0 || Boolean(extraChosen);
}

/**
 * How many photos the filters show, while a filter is chosen or something else hides photos, with
 * Clear filters when one is chosen.
 */
export function FilterResult({
  shown,
  total,
  chosen,
  hiding,
  onClear,
}: {
  shown: number;
  total: number;
  chosen: boolean;
  hiding?: boolean;
  onClear: () => void;
}) {
  if (!chosen && !hiding) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ResultText shown={shown} total={total} />
      {chosen && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon />
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** "Showing N of M photos", or a warning that none match. */
function ResultText({ shown, total }: { shown: number; total: number }) {
  if (shown === 0) {
    return <span className="text-amber-700 dark:text-amber-400">No photos match the filters</span>;
  }
  return (
    <span className="text-muted-foreground">
      Showing {shown} of {total} {total === 1 ? "photo" : "photos"}
    </span>
  );
}

/** A filter's choices, each with its button text; undefined is the one it starts on. */
export type ToggleChoices<T extends string> = [T | undefined, string][];

const CHOICES: ToggleChoices<FilterChoice> = [
  [undefined, "Any"],
  ["with", "With"],
  ["without", "Without"],
];

/** One filter's buttons (Any, With and Without unless `choices` says), after its label. */
export function FilterToggle<T extends string = FilterChoice>({
  label,
  choice,
  onChange,
  choices = CHOICES as ToggleChoices<T>,
}: {
  label: string;
  choice?: T;
  onChange: (choice?: T) => void;
  choices?: ToggleChoices<T>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div role="group" aria-label={label} className="bg-background flex rounded-md border p-0.5">
        {choices.map(([value, text]) => (
          <button
            key={text}
            type="button"
            aria-pressed={choice === value}
            onClick={() => onChange(value)}
            className={cn(
              "focus-visible:ring-ring rounded px-2 py-0.5 text-xs outline-none focus-visible:ring-2",
              choice === value
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
