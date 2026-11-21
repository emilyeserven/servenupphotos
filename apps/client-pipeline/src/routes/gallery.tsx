import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  type InFlightRead,
  photosInFlightQuery,
  publishedPhotosQuery,
  type PublishedResponse,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { BulkGroupsCard } from "@/components/gallery/bulk-groups-card";
import { BulkLowerTier } from "@/components/gallery/bulk-lower-tier";
import { BulkUndecided } from "@/components/gallery/bulk-undecided";
import { type GalleryFile, galleryFiles, mergedImages } from "@/components/gallery/gallery-files";
import { type GalleryRead, GalleryHeader } from "@/components/gallery/gallery-header";
import { GalleryLightbox } from "@/components/gallery/gallery-lightbox";
import {
  type GridFilters,
  GRID_FILTER_PARAMS,
  GridFilterBar,
  parseGridFilters,
  useGridFilters,
} from "@/components/gallery/grid-filters";
import { JumpBox } from "@/components/gallery/jump-box";
import { scrollToTile } from "@/components/gallery/kind-mark";
import { PhotoGrid } from "@/components/gallery/photo-grid";
import { defaultOrder, sortEntries } from "@/components/gallery/photo-sort";
import {
  type PlaceSearch,
  PlaceFilterToggles,
  parsePlaceSearch,
  usePlaceFilter,
} from "@/components/gallery/place-filter";
import { type Selection, fileName } from "@/components/gallery/published-file";
import { ShowToggles, SortToggles, useSetShowSearch } from "@/components/gallery/show-and-sort";
import { Page } from "@/components/page";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filter-bar";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent } from "@/components/ui/card";
import { useUntitledDrafts } from "@/lib/drafts";
import { GALLERY_FILTER_KEYS, galleryFilters } from "@/lib/gallery-filters";
import {
  type ShowSearch,
  SHOW_PARAMS,
  applyShow,
  parseShowSearch,
  showChanged,
} from "@/lib/gallery-show";
import { prefixedFilters } from "@/lib/photo-data-filters";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * The prefix of the Gallery's With and Without filters in the URL, such as `?hasTitle=without`, so
 * they don't clash with the portfolio Grid's filters, such as `?place=<id>`.
 */
const HAS_FILTERS = "has";

/** The search params of the Gallery's own filters besides the With and Without ones. */
const GALLERY_FILTER_PARAMS = [...SHOW_PARAMS, "placeId", "placeGps", ...GRID_FILTER_PARAMS];

type GallerySearch = PlaceSearch & ShowSearch & GridFilters;

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): GallerySearch => ({
    ...prefixedFilters(search, HAS_FILTERS, GALLERY_FILTER_KEYS),
    ...parseGridFilters(search),
    ...parsePlaceSearch(search),
    ...parseShowSearch(search),
  }),
});

function GalleryPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      wide
      title="Gallery"
      description="Every photo in the portfolio, as the next Commit will save it. Show the drafts, Undecided and Lower Tier photos to see where each would go among the published ones. Editing one saves the change to the “Add photo data” pull request."
    >
      <QueryResult query={settings} pendingLabel="Reading settings…">
        {(data) => (data.github.repo && data.github.token.set ? <Gallery /> : <NotSetUp />)}
      </QueryResult>
    </Page>
  );
}

/** Says the GitHub repository and token are needed first. */
function NotSetUp() {
  return (
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
  );
}

const NO_FILES: GalleryFile[] = [];

/**
 * Every photo: the base branch's, drawn as soon as they're read, with the pull request's and the
 * local edits laid over them once those are read too.
 */
function useGalleryFiles(published?: PublishedResponse, inFlight?: InFlightRead) {
  const edits = useLocalEditsStore((s) => s.edits);
  const keepDrafts = useUntitledDrafts();
  return useMemo(
    () => (published ? galleryFiles(published, inFlight, edits, keepDrafts) : NO_FILES),
    [published, inFlight, edits, keepDrafts],
  );
}

/** The base branch's and the pull request's reads, refreshed together. */
function useGalleryReads() {
  const published = useQuery(publishedPhotosQuery);
  const inFlight = useQuery(photosInFlightQuery);
  const read: GalleryRead | undefined = published.data && {
    published: published.data,
    images: mergedImages(published.data, inFlight.data),
  };
  return {
    published,
    inFlight: inFlight.data,
    read,
    fetching: published.isFetching || inFlight.isFetching,
    refresh: () => void Promise.all([published.refetch(), inFlight.refetch()]),
  };
}

function Gallery() {
  const reads = useGalleryReads();
  const all = useGalleryFiles(reads.published.data, reads.inFlight);
  const [filter, setFilter] = useState("");
  const selection = useSelection();
  const files = useShownFiles(all, filter);
  const [openPath, setOpenPath] = useState<string | null>(null);
  return (
    <>
      <GalleryHeader
        read={reads.read}
        files={all}
        fetching={reads.fetching}
        onRefresh={reads.refresh}
        filter={filter}
        onFilterChange={setFilter}
        selecting={selection.selected !== null}
        onSelectingChange={selection.toggleSelecting}
      />
      <GalleryFilters all={all} files={files} />
      <BulkCards all={all} shown={files.shown} selection={selection} />
      <QueryResult query={reads.published} pendingLabel="Reading the portfolio's photos…">
        {(data) => (
          <PhotoGrid
            branch={data.branch}
            total={all.length}
            images={reads.read?.images ?? data.images}
            shown={files.shown}
            selection={selection.selected}
            onToggle={selection.toggle}
            highlight={files.search.photo}
            onOpen={setOpenPath}
          />
        )}
      </QueryResult>
      <GalleryLightbox files={files.shown} openPath={openPath} onOpenPath={setOpenPath} />
      <Jump all={files.sorted} current={files.search.photo} />
    </>
  );
}

/**
 * While choosing photos, the cards that add albums, tags and genres to them, send them to Undecided
 * or mark them Lower Tier.
 */
function BulkCards({
  all,
  shown,
  selection,
}: {
  all: GalleryFile[];
  shown: GalleryFile[];
  selection: ReturnType<typeof useSelection>;
}) {
  if (!selection.selected || all.length === 0) return null;
  return (
    <>
      <BulkGroupsCard
        files={all}
        shown={shown}
        selection={selection.selected}
        onSelectionChange={selection.setSelected}
      />
      <BulkUndecided files={all} selection={selection.selected} />
      <BulkLowerTier files={all} selection={selection.selected} />
    </>
  );
}

/**
 * The jump box for the drafts and Undecided photos, and scrolling to the photo `?photo=` names
 * once it's drawn.
 */
function Jump({ all, current }: { all: GalleryFile[]; current?: string }) {
  const setSearch = useSetShowSearch();
  useEffect(() => {
    if (current) scrollToTile(current);
  }, [current]);
  const jump = (file: GalleryFile) => {
    const kind =
      file.kind === "undecided" ? { undecided: true as const } : { drafts: true as const };
    void setSearch({ photo: file.path, ...kind }).then(() => scrollToTile(file.path));
  };
  return (
    <JumpBox
      entries={all.filter((file) => file.kind === "draft" || file.kind === "undecided")}
      current={current}
      onJump={jump}
    />
  );
}

/**
 * The Gallery's filters: its With and Without ones with its place, Show group and sort, then the
 * portfolio Grid's.
 */
function GalleryFilters({ all, files }: { all: GalleryFile[]; files: ShownFiles }) {
  const { shown, filters, defs, place, grid, search } = files;
  return (
    <>
      <PhotoFilterBar
        filters={filters}
        shown={shown.length}
        total={all.length}
        hiding={shown.length < all.length}
        extraChosen={files.extraChosen}
        extraParams={GALLERY_FILTER_PARAMS}
        prefix={HAS_FILTERS}
        defs={defs}
      >
        <PlaceFilterToggles filter={place} />
        <ShowToggles files={all} search={search} />
        <SortToggles sort={files.sort} order={files.order} />
      </PhotoFilterBar>
      <GridFilterBar photos={grid.photos} />
    </>
  );
}

type ShownFiles = ReturnType<typeof useShownFiles>;

/**
 * The photos in the URL's sort, and the ones of them that match the search text, the filters, the
 * Show group, the place chosen and the portfolio Grid's filters. The Grid filters' counts are out
 * of what the others leave.
 */
function useShownFiles(all: GalleryFile[], filter: string) {
  const search = Route.useSearch();
  const place = usePlaceFilter();
  const defs = galleryFilters(place.places);
  const { filters, filter: applyFilters } = usePhotoFilters(HAS_FILTERS, defs);
  const { sort, order } = sortOf(search);
  const sorted = useMemo(() => sortEntries(all, sort, order), [all, sort, order]);
  const matching = sorted.filter((file) => matches(file, filter));
  const grid = useGridFilters(all, place.apply(applyShow(applyFilters(matching), search)));
  return {
    search,
    filters,
    defs,
    sort,
    order,
    place,
    grid,
    sorted,
    extraChosen: otherChosen(search, grid.count),
    shown: grid.shown,
  };
}

/** The Gallery's sort and which way it runs, from the URL or else their defaults. */
function sortOf(search: ShowSearch) {
  const sort = search.sort ?? "taken";
  return { sort, order: search.order ?? defaultOrder(sort) };
}

/** Whether one of the Gallery's filters besides the With and Without ones is set. */
function otherChosen(search: GallerySearch, gridCount: number): boolean {
  return showChanged(search) || search.placeId !== undefined || gridCount > 0;
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

/** Whether the photo's title or file names contain filter, ignoring case. */
function matches(file: GalleryFile, filter: string): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  return [file.name, file.photoName, fileName(file.path)].some((text) =>
    text.toLowerCase().includes(query),
  );
}
