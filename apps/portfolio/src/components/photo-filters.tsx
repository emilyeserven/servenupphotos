import { useNavigate, useSearch } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { GroupPicker } from "@portfolio/components/group-picker";
import { MoreFilters } from "@portfolio/components/more-filters";
import { PhotoSearchBox } from "@portfolio/components/photo-search-box";
import { PlacesFilter } from "@portfolio/components/places-filter";
import { WhenFilter } from "@portfolio/components/when-filter";
import { Button } from "@portfolio/components/ui/button";
import { locationOptions } from "@portfolio/lib/filter-options";
import {
  FILTER_KEYS,
  filterCount,
  filterPhotos,
  LOCATION_KEYS,
  locationFilters,
  locationSelection,
  parseFilters,
  type PhotoFilters,
  withoutFilters,
} from "@portfolio/lib/photo-filters";
import type { Photo } from "@portfolio/lib/photos";
import { parseTextSearch, searchPhotos, TEXT_SEARCH_KEY } from "@portfolio/lib/text-search";
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
      resetScroll: false,
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
      resetScroll: false,
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

/**
 * A **Show filters** button that opens filters narrowing the view's photos by place (any number of
 * countries, cities and places), album and tag, kept in the URL so a link keeps them and the menu
 * carries them to the other views. The button says how many filters are set while they're hidden,
 * and **Clear filters** stays beside it. `facet` is the photos the counts are out of, when the view
 * narrows them with its own filters; `own` are those filters, shown after the shared ones.
 * `searchable` puts the text search box before the button (see `PhotoSearchBox`), which counts as
 * a filter and narrows the counts too.
 */
export function PhotoFilterBar({
  photos,
  facet = photos,
  own = NO_OWN_FILTERS,
  searchable = false,
}: {
  photos: Photo[];
  facet?: Photo[];
  own?: OwnFilters;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const filters = useFilters();
  const setFilters = useSetFilters();
  const search = useTextSearch(searchable);
  const clearFilters = useClearFilters([...own.keys, ...search.keys]);
  const listId = useId();
  const count = filterCount(filters) + own.count + search.count;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {searchable && <PhotoSearchBox />}
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
              facet={searchPhotos(facet, search.query)}
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
 * The text search, while the bar has one: its URL key for **Clear filters**, the search, and 1 for
 * the button's count while it's set.
 */
function useTextSearch(searchable: boolean): { keys: string[]; query?: string; count: number } {
  const { q } = parseTextSearch(useSearch({ strict: false }));
  if (!searchable) return { keys: [], count: 0 };
  return { keys: [TEXT_SEARCH_KEY], query: q, count: q ? 1 : 0 };
}

/**
 * How the filters look over the map: laid out in the map's row of controls, solid like its other
 * controls rather than see-through in dark mode, and each dropdown only as wide as its choice.
 */
const OVER_MAP =
  "contents [&_button]:bg-background dark:[&_button]:bg-background [&_select]:bg-background [&_select]:[field-sizing:content] dark:[&_select]:bg-background";

/**
 * The **Groups** and **When** pickers behind a **More filters** button, after the view's own
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
 * The Places combobox and the **Groups** and **When** pickers. Each choice says how many of `facet`
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

/** The **Groups** picker, for the album, tag and genre, and the **When** picker. */
function GroupDropdowns({ facet, filters, setFilters }: DropdownProps) {
  return (
    <>
      <GroupPicker facet={facet} filters={filters} setFilters={setFilters} />
      <WhenFilter facet={facet} filters={filters} setFilters={setFilters} />
    </>
  );
}

/** What a view shows when its filters leave none of its photos: nothing while `count` has some. */
export function NoMatchingPhotos({ count, className }: { count: number; className?: string }) {
  if (count > 0) return null;
  return <p className={cn("text-muted-foreground", className)}>No photos match these filters.</p>;
}
