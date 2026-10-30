import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckIcon, ListChecksIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { type PublishedFile, type PublishedResponse, publishedPhotosQuery } from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BulkGroupsCard } from "@/components/gallery/bulk-groups-card";
import { PhotoGrid } from "@/components/gallery/photo-grid";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import {
  type GallerySort,
  GallerySortToggle,
  parseGallerySort,
  sortGallery,
  useGallerySort,
} from "@/components/gallery/gallery-sort";
import {
  type UndecidedChoice,
  UndecidedToggle,
  parseUndecided,
  useUndecidedFilter,
} from "@/components/gallery/undecided-filter";
import {
  type PlaceSearch,
  PlaceFilterToggles,
  parsePlaceSearch,
  usePlaceFilter,
} from "@/components/gallery/place-filter";
import {
  type GridFilters,
  GRID_FILTER_PARAMS,
  GridFilterBar,
  parseGridFilters,
  useGridFilters,
} from "@/components/gallery/grid-filters";
import { prefixedFilters } from "@/lib/photo-filters";
import { type Selection, fileName, photoName } from "@/components/gallery/published-file";
import { OfflineNotice } from "@/components/offline-notice";

/**
 * The prefix of the Gallery's With and Without filters in the URL, such as `?hasTitle=without`, so
 * they don't clash with the portfolio Grid's filters, such as `?place=<id>`.
 */
const HAS_FILTERS = "has";

/** The search params of the Gallery's own filters besides the With and Without ones. */
const GALLERY_FILTER_PARAMS = ["undecided", "placeId", "placeGps", ...GRID_FILTER_PARAMS];

type GallerySearch = GalleryOwnSearch & GridFilters;

interface GalleryOwnSearch extends PlaceSearch {
  /** Whether Undecided photos are shown too, or only they are; hidden when left out. */
  undecided?: UndecidedChoice;
  /** Sorts by when each photo was added to the portfolio; by when it was taken when left out. */
  sort?: GallerySort;
}

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): GallerySearch => ({
    ...prefixedFilters(search, HAS_FILTERS),
    ...parseGridFilters(search),
    ...parsePlaceSearch(search),
    undecided: parseUndecided(search),
    sort: parseGallerySort(search),
  }),
});

function GalleryPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      wide
      title="Gallery"
      description="Photos already in the portfolio. Editing one saves the change to the “Add photo data” pull request, where it waits in Photos in Flight until it merges."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <PublishedPhotos />
          ) : (
            <Card>
              <CardContent>
                <p className="text-muted-foreground">
                  Not set up: add the GitHub repository and token in{" "}
                  <Link to="/settings" className="text-foreground underline underline-offset-4">
                    Settings
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )
        }
      </QueryResult>
    </Page>
  );
}

function PublishedPhotos() {
  const published = useQuery(publishedPhotosQuery);
  const [filter, setFilter] = useState("");
  const selection = useSelection();
  const files = useShownFiles(published.data, filter);
  const { shown } = files;
  return (
    <>
      <GalleryHeader
        published={published}
        filter={filter}
        onFilterChange={setFilter}
        selecting={selection.selected !== null}
        onSelectingChange={selection.toggleSelecting}
      />
      <GalleryFilters files={files} />
      {selection.selected && published.data && (
        <BulkGroupsCard
          files={published.data.files}
          shown={shown}
          selection={selection.selected}
          onSelectionChange={selection.setSelected}
        />
      )}
      <QueryResult query={published} pendingLabel="Reading the portfolio's photos from GitHub…">
        {(data) => (
          <PhotoGrid
            data={data}
            shown={shown}
            filter={filter}
            selection={selection.selected}
            onToggle={selection.toggle}
          />
        )}
      </QueryResult>
    </>
  );
}

/**
 * The Gallery's filters: its With and Without ones with its place, Undecided and sort, then the
 * portfolio Grid's.
 */
function GalleryFilters({ files }: { files: ShownFiles }) {
  const { shown, total, filters, undecided, sort, place, grid } = files;
  return (
    <>
      <PhotoFilterBar
        filters={filters}
        shown={shown.length}
        total={total}
        hiding={shown.length < total}
        extraChosen={files.extraChosen}
        extraParams={GALLERY_FILTER_PARAMS}
        prefix={HAS_FILTERS}
      >
        <PlaceFilterToggles filter={place} />
        <UndecidedToggle choice={undecided} />
        <GallerySortToggle sort={sort} />
      </PhotoFilterBar>
      <GridFilterBar photos={grid.photos} />
    </>
  );
}

const NO_FILES: PublishedFile[] = [];

type ShownFiles = ReturnType<typeof useShownFiles>;

/** Whether one of the Gallery's filters besides the With and Without ones is set. */
function otherChosen(undecided: unknown, placeId: unknown, gridCount: number): boolean {
  return undecided !== undefined || placeId !== undefined || gridCount > 0;
}

/**
 * The photos that match the search text, the filters, the place chosen and the portfolio Grid's
 * filters, in the URL's sort, out of how many there are. The Grid filters' counts are out of what
 * the others leave.
 */
function useShownFiles(data: PublishedResponse | undefined, filter: string) {
  const { filters, filter: applyFilters } = usePhotoFilters(HAS_FILTERS);
  const { choice: undecided, apply: applyUndecided } = useUndecidedFilter();
  const sort = useGallerySort();
  const place = usePlaceFilter();
  const all = data?.files ?? NO_FILES;
  const grid = useGridFilters(
    all,
    place.apply(applyUndecided(applyFilters(shownFiles(all, filter, sort)))),
  );
  return {
    filters,
    undecided,
    sort,
    place,
    grid,
    extraChosen: otherChosen(undecided, place.placeId, grid.count),
    shown: grid.shown,
    total: all.length,
  };
}

/** The photos chosen to add albums and tags to, and turning choosing them on and off. */
function useSelection() {
  const [selected, setSelected] = useState<Selection>(null);
  return {
    selected,
    setSelected,
    toggleSelecting: () => setSelected((current) => (current ? null : new Set())),
    toggle: (path: string) => setSelected((current) => current && toggled(current, path)),
  };
}

/** selection with path added, or taken out when it's there. */
function toggled(selection: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(selection);
  if (!next.delete(path)) next.add(path);
  return next;
}

interface GalleryHeaderProps {
  published: UseQueryResult<PublishedResponse>;
  filter: string;
  onFilterChange: (filter: string) => void;
  selecting: boolean;
  onSelectingChange: () => void;
}

function GalleryHeader({
  published,
  filter,
  onFilterChange,
  selecting,
  onSelectingChange,
}: GalleryHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio photos</CardTitle>
        <CardDescription>
          {published.data
            ? `${published.data.repo}, JSON in ${published.data.folder} on ${published.data.branch}`
            : "Reading the photo JSON on the base branch."}
        </CardDescription>
        <CardAction className="flex gap-2">
          <SelectButton on={selecting} disabled={!published.data} onClick={onSelectingChange} />
          <Button
            variant="outline"
            size="sm"
            disabled={published.isFetching}
            onClick={() => void published.refetch()}
          >
            {published.isFetching && <Spinner />}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {published.data && <Summary data={published.data} />}
        <label className="relative block max-w-sm">
          <span className="sr-only">Filter photos</span>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Filter by title or file name"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="pl-9"
          />
        </label>
      </CardContent>
    </Card>
  );
}

/** Turns choosing photos to add albums and tags to on, or off when it's on. */
function SelectButton({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={on ? "default" : "outline"}
      size="sm"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {on ? <CheckIcon /> : <ListChecksIcon />}
      {on ? "Done" : "Select"}
    </Button>
  );
}

/** The photos to show, in sort, that match filter. */
function shownFiles(
  files: PublishedFile[],
  filter: string,
  sort: GallerySort | undefined,
): PublishedFile[] {
  return sortGallery(files, sort).filter((file) => matches(file, filter));
}

/**
 * How many photos there are, and how many of them have changes waiting in the pull request, under
 * the offline notice when R2 couldn't be reached.
 */
function Summary({ data }: { data: PublishedResponse }) {
  const count = data.files.length;
  return (
    <>
      <OfflineNotice images={data.images} />
      <p className="text-muted-foreground">
        {count === 1 ? "1 photo" : `${count} photos`}
        <InFlightCount data={data} />
        {r2Problem(data.images)}
      </p>
    </>
  );
}

/** Why R2 couldn't be checked, after the count; nothing when it was, or the offline notice says so. */
function r2Problem(images: PublishedResponse["images"]): string {
  if (images.checked || images.offline) return "";
  return `. ${images.message ?? "Couldn't check R2."}`;
}

/** How many of the photos the pull request changes, linked to it, when it changes any. */
function InFlightCount({ data }: { data: PublishedResponse }) {
  const inFlight = data.files.filter((file) => file.inFlight).length;
  if (!data.pullRequest || inFlight === 0) return null;
  return (
    <>
      ; {inFlight} with changes in{" "}
      <a
        href={data.pullRequest.url}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-4"
      >
        #{data.pullRequest.number}
      </a>
    </>
  );
}

/** Whether the photo's title or file names contain filter, ignoring case. */
function matches(file: PublishedFile, filter: string): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  return [photoName(file), file.photoName, fileName(file.path)].some((text) =>
    text.toLowerCase().includes(query),
  );
}
