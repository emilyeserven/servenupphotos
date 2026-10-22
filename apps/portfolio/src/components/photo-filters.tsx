import { useNavigate, useSearch } from "@tanstack/react-router";
import { FolderOpen, type LucideIcon, MapPin, Tag, X } from "lucide-react";
import { useScriptDisplay } from "@/components/script-display-provider";
import { Button } from "@/components/ui/button";
import { albumOptions, type FilterOption, locationOptions, tagOptions } from "@/lib/filter-options";
import {
  FILTER_KEYS,
  filterPhotos,
  hasFilters,
  LOCATION_KEYS,
  parseFilters,
  type PhotoFilters,
  withoutFilters,
} from "@/lib/photo-filters";
import type { Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** The filters in the current URL, for any portfolio view. */
function useFilters(): PhotoFilters {
  return parseFilters(useSearch({ strict: false }));
}

/** Sets the filters in the URL, keeping the view's own settings, such as its sort. */
function useSetFilters() {
  const navigate = useNavigate();
  return (next: PhotoFilters) => {
    const cleared = Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined]));
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...cleared, ...next }),
    });
  };
}

/** A choice's value in its dropdown: the filter's key and its value, such as "city:Seoul". */
function optionValue({ key, value }: Pick<FilterOption, "key" | "value">): string {
  return `${key}:${value}`;
}

/** The filter a dropdown's value sets, or none for "All". */
function filterOf(selected: string): PhotoFilters {
  const at = selected.indexOf(":");
  return at === -1 ? {} : { [selected.slice(0, at)]: selected.slice(at + 1) };
}

/**
 * Dropdowns that narrow the view's photos by location (a country, city or place), album and tag,
 * kept in the URL so a link keeps them and the menu carries them to the other views. Each choice
 * says how many of `photos` it would show, given the other filters. The tag dropdown is left out
 * while there are no tags.
 */
export function PhotoFilterBar({ photos }: { photos: Photo[] }) {
  const filters = useFilters();
  const setFilters = useSetFilters();
  const groupFacet = filterPhotos(photos, withoutFilters(filters, LOCATION_KEYS));
  const albumFacet = filterPhotos(photos, withoutFilters(filters, ["album"]));
  const tagFacet = filterPhotos(photos, withoutFilters(filters, ["tag"]));
  const tags = tagOptions(tagFacet);

  /** Replaces the filters `keys` name with the dropdown's choice. */
  function choose(keys: readonly string[], selected: string) {
    setFilters({ ...withoutFilters(filters, keys as typeof FILTER_KEYS), ...filterOf(selected) });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Filters">
      <FilterSelect
        label="Location"
        Icon={MapPin}
        options={locationOptions(photos, groupFacet)}
        filters={filters}
        onChange={(selected) => choose(LOCATION_KEYS, selected)}
      />
      <FilterSelect
        label="Album"
        Icon={FolderOpen}
        options={albumOptions(albumFacet)}
        filters={filters}
        onChange={(selected) => choose(["album"], selected)}
      />
      {tags.length > 0 && (
        <FilterSelect
          label="Tag"
          Icon={Tag}
          options={tags}
          filters={filters}
          onChange={(selected) => choose(["tag"], selected)}
        />
      )}
      {hasFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
          <X aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** The value of the dropdown's choice the filters set, or "" for "All". */
function selectedValue(options: FilterOption[], filters: PhotoFilters): string {
  const chosen = options.find((option) => filters[option.key] === option.value);
  return chosen ? optionValue(chosen) : "";
}

/**
 * A choice's text: indented under what it's in, with how many photos it would show. The chosen one
 * isn't indented, as the closed dropdown shows it on its own.
 */
function optionText(option: FilterOption, name: string, chosen: boolean): string {
  return `${"   ".repeat(chosen ? 0 : option.depth)}${name} (${option.count})`;
}

function FilterSelect({
  label,
  Icon,
  options,
  filters,
  onChange,
}: {
  label: string;
  Icon: LucideIcon;
  options: FilterOption[];
  filters: PhotoFilters;
  onChange: (selected: string) => void;
}) {
  const { script } = useScriptDisplay();
  const selected = selectedValue(options, filters);
  return (
    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 max-w-56 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {/* A place in two cities is listed under each, so the key has its position too. */}
        {options.map((option, index) => (
          <option key={`${index}-${optionValue(option)}`} value={optionValue(option)}>
            {optionText(option, option.label[script], optionValue(option) === selected)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** What a view shows when its filters leave none of its photos: nothing while `count` has some. */
export function NoMatchingPhotos({ count, className }: { count: number; className?: string }) {
  if (count > 0) return null;
  return <p className={cn("text-muted-foreground", className)}>No photos match these filters.</p>;
}
