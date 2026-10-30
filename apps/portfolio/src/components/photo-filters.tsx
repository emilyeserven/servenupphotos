import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  FolderOpen,
  type LucideIcon,
  Shapes,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { hiddenText } from "@portfolio/components/hidden-note";
import { MoreFilters } from "@portfolio/components/more-filters";
import { PlacesFilter } from "@portfolio/components/places-filter";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import { Button } from "@portfolio/components/ui/button";
import {
  albumOptions,
  type FilterOption,
  genreOptions,
  locationOptions,
  tagOptions,
} from "@portfolio/lib/filter-options";
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
} from "@portfolio/lib/photo-filters";
import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";

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
export interface OwnFilters {
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
        <ClearFilters count={count} onClear={clearFilters} />
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

/**
 * How the filters look over the map: laid out in the map's row of controls, solid like its other
 * controls rather than see-through in dark mode, and each dropdown only as wide as its choice.
 */
const OVER_MAP =
  "contents [&_button]:bg-background dark:[&_button]:bg-background [&_select]:bg-background [&_select]:[field-sizing:content] dark:[&_select]:bg-background";

/**
 * The album, tag and genre dropdowns behind a **More filters** button, after the view's own
 * filters (`own`, such as the map's days), then `children` and **Clear filters** while any filter
 * is set, for a view with no room to spare for the **Show filters** button, such as the map.
 */
export function MoreFilterControls({
  photos,
  own,
  children,
}: {
  photos: Photo[];
  /** The view's own filters shown first in **More filters**, and how many of them are set. */
  own: { count: number; children: ReactNode };
  /** More controls after the filters, such as the map's **View in grid**. */
  children?: ReactNode;
}) {
  const props = { photos, facet: photos, filters: useFilters(), setFilters: useSetFilters() };
  const clearFilters = useClearFilters([]);
  const groupCount = filterCount(withoutFilters(props.filters, LOCATION_KEYS));
  return (
    <div className={OVER_MAP}>
      <MoreFilters badge={<FilterCount count={groupCount + own.count} />}>
        {own.children}
        <GroupDropdowns {...props} />
      </MoreFilters>
      {children}
      <ClearFilters count={filterCount(props.filters)} onClear={clearFilters} />
    </div>
  );
}

/** A **Clear filters** button, shown only while `count` filters are set. */
function ClearFilters({ count, onClear }: { count: number; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClear} className="bg-background/80">
      <X aria-hidden />
      Clear filters
    </Button>
  );
}

/** How many filters are set, as a badge; nothing when none are. */
export function FilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

/** What the filter dropdowns choose from and change. */
interface DropdownProps {
  /** The photos the choices are listed from. */
  photos: Photo[];
  /** The photos each choice's count is out of. */
  facet: Photo[];
  filters: PhotoFilters;
  setFilters: (next: PhotoFilters) => void;
}

/**
 * The Places combobox and the album, tag and genre dropdowns. Each choice says how many of `facet`
 * it would show, given the other filters.
 */
function FilterDropdowns(props: DropdownProps) {
  return (
    <>
      <PlacesDropdown {...props} />
      <GroupDropdowns {...props} />
    </>
  );
}

/** The Places combobox, which chooses any number of countries, cities and places. */
function PlacesDropdown({ photos, facet, filters, setFilters }: DropdownProps) {
  const placeFacet = filterPhotos(facet, withoutFilters(filters, LOCATION_KEYS));
  return (
    <PlacesFilter
      options={locationOptions(photos, placeFacet)}
      selected={locationSelection(filters)}
      onChange={(selection) =>
        setFilters({ ...withoutFilters(filters, LOCATION_KEYS), ...locationFilters(selection) })
      }
    />
  );
}

/** The album, tag and genre dropdowns; the tag and genre ones are left out while there are none. */
function GroupDropdowns({ facet, filters, setFilters }: DropdownProps) {
  const albums = albumOptions(filterPhotos(facet, withoutFilters(filters, ["album"])));
  const tags = tagOptions(filterPhotos(facet, withoutFilters(filters, ["tag"])));
  const genres = genreOptions(filterPhotos(facet, withoutFilters(filters, ["genre"])));

  /** Replaces the filters `keys` name with the ones chosen. */
  function choose(keys: readonly FilterKey[], chosen: PhotoFilters) {
    setFilters({ ...withoutFilters(filters, keys), ...chosen });
  }

  return (
    <>
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
      {genres.length > 0 && (
        <FilterSelect
          label="Genre"
          Icon={Shapes}
          options={genres}
          selected={selectedValue(genres, filters)}
          onChange={(selected) => choose(["genre"], filterOf(selected))}
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
 * `plural` names them all, such as "lenses", when adding an "s" doesn't. While one is chosen, an X
 * beside it goes back to "All".
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
  // Choices that would show no photos, given the other filters, are left out, unless chosen.
  const shown = options.filter((option) => option.count > 0 || optionValue(option) === selected);
  const hidden = options.length - shown.length;
  return (
    // The icon, X and chevron sit over the dropdown, inside its border, like the Places button's.
    <div className="relative inline-flex items-center text-sm text-muted-foreground">
      <Icon className="pointer-events-none absolute left-2.5 size-4" aria-hidden />
      <label className="contents">
        <span className="sr-only">{label}</span>
        <select
          value={selected}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-8 max-w-56 cursor-pointer appearance-none truncate rounded-md border bg-background pl-8 text-sm text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
            selected ? "pr-14" : "pr-8",
          )}
        >
          <option value="">All {plural}</option>
          {shown.map((option, index) => (
            <option key={`${index}-${optionValue(option)}`} value={optionValue(option)}>
              {optionText(option, option.label[script], optionValue(option) === selected)}
            </option>
          ))}
          {hidden > 0 && <option disabled>{hiddenText(hidden, "choices")}</option>}
        </select>
      </label>
      {selected && (
        <ClearFilterButton
          label={label}
          onClear={() => onChange("")}
          className="absolute right-7"
        />
      )}
      <ChevronsUpDown
        className="pointer-events-none absolute right-2.5 size-4 opacity-50"
        aria-hidden
      />
    </div>
  );
}

/** What a view shows when its filters leave none of its photos: nothing while `count` has some. */
export function NoMatchingPhotos({ count, className }: { count: number; className?: string }) {
  if (count > 0) return null;
  return <p className={cn("text-muted-foreground", className)}>No photos match these filters.</p>;
}
