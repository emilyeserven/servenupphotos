import { useNavigate, useSearch } from "@tanstack/react-router";
import { FilterIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { editedData } from "@/lib/undecided";
import {
  type FilterChoice,
  type FilterKey,
  type PhotoFilters,
  PHOTO_FILTERS,
  filterCount,
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
 * The filters chosen on the Photos in Flight page, kept in the URL so a reload keeps them, and the
 * files that pass them with the local edits made.
 */
export function usePhotoFilters() {
  const filters = useSearch({ from: "/in-flight", select: parseFilters });
  const edits = useLocalEditsStore((s) => s.edits);
  return {
    filters,
    filter: <T extends FilteredFile>(files: T[]): T[] =>
      files.filter((file) => matchesFilters(editedData(file, edits), filters)),
  };
}

/** Sets one filter, or clears it with undefined, or every filter with null. */
function useSetFilter() {
  const navigate = useNavigate({ from: "/in-flight" });
  return (key: FilterKey | null, choice?: FilterChoice) =>
    void navigate({
      search: (prev) => (key ? { ...prev, [key]: choice } : withoutFilters(prev)),
      replace: true,
    });
}

/** The search params with every filter cleared. */
function withoutFilters<T extends object>(search: T): T {
  return { ...search, ...Object.fromEntries(PHOTO_FILTERS.map(({ key }) => [key, undefined])) };
}

/**
 * The filter bar above the photos: Any, With or Without for each thing a photo can have, how many
 * photos pass, and Clear. Nothing when there are no photos to filter.
 */
export function PhotoFilterBar({
  filters,
  shown,
  total,
}: {
  filters: PhotoFilters;
  shown: number;
  total: number;
}) {
  const setFilter = useSetFilter();
  if (total === 0) return null;
  const active = filterCount(filters) > 0;
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
        </div>
        {active && <FilterResult shown={shown} total={total} onClear={() => setFilter(null)} />}
      </CardContent>
    </Card>
  );
}

/** How many photos the filters show, with a button that clears them. */
function FilterResult({
  shown,
  total,
  onClear,
}: {
  shown: number;
  total: number;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(shown === 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}
      >
        {shown === 0
          ? "No photos match the filters"
          : `Showing ${shown} of ${total} ${total === 1 ? "photo" : "photos"}`}
      </span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <XIcon />
        Clear filters
      </Button>
    </div>
  );
}

const CHOICES: [FilterChoice | undefined, string][] = [
  [undefined, "Any"],
  ["with", "With"],
  ["without", "Without"],
];

/** One filter's Any, With and Without buttons, after its label. */
function FilterToggle({
  label,
  choice,
  onChange,
}: {
  label: string;
  choice?: FilterChoice;
  onChange: (choice?: FilterChoice) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div role="group" aria-label={label} className="bg-background flex rounded-md border p-0.5">
        {CHOICES.map(([value, text]) => (
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
