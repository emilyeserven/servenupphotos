import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  FolderOpen,
  type LucideIcon,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { PlacesFilter } from "@/components/places-filter";
import { useScriptDisplay } from "@/components/script-display-provider";
import { Button } from "@/components/ui/button";
import { albumOptions, type FilterOption, locationOptions, tagOptions } from "@/lib/filter-options";
import {
  FILTER_KEYS,
  filterCount,
  type FilterKey,
  filterPhotos,
  LOCATION_KEYS,
  locationFilters,
  locationSelection,
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

/** Clears the shared filters and the view's own ones the keys name, keeping its other settings. */
function useClearFilters(ownKeys: readonly string[]) {
  const navigate = useNavigate();
  return () => {
    const cleared = Object.fromEntries([...FILTER_KEYS, ...ownKeys].map((key) => [key, undefined]));
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...cleared }),
    });
  };
}

/** A view's own filters, shown after the shared ones, such as the Table's camera and settings. */
interface OwnFilters {
  /** Their keys in the URL, which **Clear filters** clears too. */
  keys: readonly string[];
  /** How many are set, added to the button's count. */
  count: number;
  children: ReactNode;
}

const NO_OWN_FILTERS: OwnFilters = { keys: [], count: 0, children: null };

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
 * A **Show filters** button that opens filters narrowing the view's photos by place (any number of
 * countries, cities and places), album and tag, kept in the URL so a link keeps them and the menu
 * carries them to the other views. The button says how many filters are set while they're hidden,
 * and **Clear filters** stays beside it. `facet` is the photos the counts are out of, when the view
 * narrows them with its own filters; `own` are those filters, shown after the shared ones.
 */
export function PhotoFilterBar({
  photos,
  facet = photos,
  own = NO_OWN_FILTERS,
}: {
  photos: Photo[];
  facet?: Photo[];
  own?: OwnFilters;
}) {
  const [open, setOpen] = useState(false);
  const filters = useFilters();
  const setFilters = useSetFilters();
  const clearFilters = useClearFilters(own.keys);
  const listId = useId();
  const count = filterCount(filters) + own.count;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal aria-hidden />
          {open ? "Hide filters" : "Show filters"}
          <FilterCount count={count} />
        </Button>
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>
      <div
        id={listId}
        hidden={!open}
        className="flex flex-wrap items-start gap-x-3 gap-y-2"
        role="group"
        aria-label="Filters"
      >
        {open && (
          <>
            <FilterDropdowns
              photos={photos}
              facet={facet}
              filters={filters}
              setFilters={setFilters}
            />
            {own.children}
          </>
        )}
      </div>
    </div>
  );
}

/** How many filters are set, as a badge; nothing when none are. */
function FilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

/**
 * The Places combobox and the album and tag dropdowns. Each choice says how many of `facet` it
 * would show, given the other filters. The tag dropdown is left out while there are no tags.
 */
function FilterDropdowns({
  photos,
  facet,
  filters,
  setFilters,
}: {
  photos: Photo[];
  facet: Photo[];
  filters: PhotoFilters;
  setFilters: (next: PhotoFilters) => void;
}) {
  const placeFacet = filterPhotos(facet, withoutFilters(filters, LOCATION_KEYS));
  const albums = albumOptions(filterPhotos(facet, withoutFilters(filters, ["album"])));
  const tags = tagOptions(filterPhotos(facet, withoutFilters(filters, ["tag"])));

  /** Replaces the filters `keys` name with the ones chosen. */
  function choose(keys: readonly FilterKey[], chosen: PhotoFilters) {
    setFilters({ ...withoutFilters(filters, keys), ...chosen });
  }

  return (
    <>
      <PlacesFilter
        options={locationOptions(photos, placeFacet)}
        selected={locationSelection(filters)}
        onChange={(selection) => choose(LOCATION_KEYS, locationFilters(selection))}
      />
      <FilterSelect
        label="Album"
        Icon={FolderOpen}
        options={albums}
        selected={selectedValue(albums, filters)}
        onChange={(selected) => choose(["album"], filterOf(selected))}
      />
      {tags.length > 0 && (
        <FilterSelect
          label="Tag"
          Icon={Tag}
          options={tags}
          selected={selectedValue(tags, filters)}
          onChange={(selected) => choose(["tag"], filterOf(selected))}
        />
      )}
    </>
  );
}

/** The value of the dropdown's choice the search sets, or "" for "All". */
export function selectedValue(options: FilterOption[], search: Record<string, unknown>): string {
  const chosen = options.find((option) => search[option.key] === option.value);
  return chosen ? optionValue(chosen) : "";
}

/**
 * A choice's text: indented under what it's in, with how many photos it would show. The chosen one
 * isn't indented, as the closed dropdown shows it on its own.
 */
function optionText(option: FilterOption, name: string, chosen: boolean): string {
  return `${"   ".repeat(chosen ? 0 : option.depth)}${name} (${option.count})`;
}

/**
 * A dropdown of one filter's choices, with "All" first; `selected` is the chosen one's value and
 * `plural` names them all, such as "lenses", when adding an "s" doesn't.
 */
export function FilterSelect({
  label,
  plural = `${label.toLowerCase()}s`,
  Icon,
  options,
  selected,
  onChange,
}: {
  label: string;
  plural?: string;
  Icon: LucideIcon;
  options: FilterOption[];
  selected: string;
  onChange: (selected: string) => void;
}) {
  const { script } = useScriptDisplay();
  return (
    // The icon and chevron sit over the dropdown, inside its border, like the Places button's.
    <label className="relative inline-flex items-center text-sm text-muted-foreground">
      <Icon className="pointer-events-none absolute left-2.5 size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 max-w-56 cursor-pointer appearance-none truncate rounded-md border bg-background pr-8 pl-8 text-sm text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
      >
        <option value="">All {plural}</option>
        {options.map((option, index) => (
          <option key={`${index}-${optionValue(option)}`} value={optionValue(option)}>
            {optionText(option, option.label[script], optionValue(option) === selected)}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2.5 size-4 opacity-50"
        aria-hidden
      />
    </label>
  );
}

/** What a view shows when its filters leave none of its photos: nothing while `count` has some. */
export function NoMatchingPhotos({ count, className }: { count: number; className?: string }) {
  if (count > 0) return null;
  return <p className={cn("text-muted-foreground", className)}>No photos match these filters.</p>;
}
