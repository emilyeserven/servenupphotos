import { createFileRoute } from "@tanstack/react-router";
import { Grid3x3, Table } from "lucide-react";
import { CameraFilterBar } from "@/components/camera-filters";
import { ColorOrderControls } from "@/components/color-order-controls";
import { DistanceBandTiles } from "@/components/distance-band-tiles";
import { DistanceFromControl } from "@/components/distance-from-control";
import { GridSortControl } from "@/components/grid-sort-control";
import { GridViewOptions } from "@/components/grid-view-options";
import { NoMatchingPhotos } from "@/components/photo-filters";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoTable } from "@/components/photo-table";
import { GridTiles, type ImagePhoto, type TileMode } from "@/components/photo-tiles";
import { SiteHomeLink } from "@/components/site-home-link";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { TILE_SHAPES, type ViewChoice, ViewSwitcher } from "@/components/view-switcher";
import { type CameraFilters, filterWithCamera, parseCameraFilters } from "@/lib/camera-filters";
import {
  type ColorFilters,
  type ColorOrderSearch,
  filterByColors,
  parseColorFilters,
  parseColorOrder,
} from "@/lib/color-search";
import type { ColorSort } from "@/lib/color-sort";
import type { Point } from "@/lib/distance";
import { DEFAULT_NEAR, nearPoint, parseNear, photoDistanceText } from "@/lib/distance-sort";
import { type GridSize, naturalSize, parseGridSize, squareSize, tableSize } from "@/lib/grid-size";
import {
  defaultOrder,
  type GridColorSpec,
  type GridSort,
  parseDateOrder,
  sortGrid,
} from "@/lib/grid-sort";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { photos as allPhotos, type Photo } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { parseTableSearch, type TableSearch } from "@/lib/table-search";
import { parseTextSearch, searchPhotos } from "@/lib/text-search";
import { useRememberViewOptions } from "@/lib/view-options";

/** How the Grid shows its photos: as tiles of either shape, or as a table. */
type ViewMode = TileMode | "table";

interface GridSearch extends ColorFilters, ColorOrderSearch, TableSearch {
  /** The text search: the words each photo's title, location or camera model has to have. */
  q?: string;
  /** Left out for the default, square tiles. */
  view?: Exclude<ViewMode, "square">;
  /** Set when each tile shows its title, place and comment under it. Left out for the default, hidden. */
  info?: true;
  /**
   * Set to false when Natural tiles gather vertical photos into rows of their own. Left out for the
   * default, which keeps the photos strictly in the sort's order, mixing wide and vertical photos in rows.
   */
  ordered?: false;
  /**
   * How big the tiles or the Table's thumbnails are. Left out for the size each view starts at:
   * Medium for Square tiles, Large for Natural tiles and Small for the Table.
   */
  size?: GridSize;
  /**
   * What the photos are sorted by, once one is picked from **Sort**. Left out for the default,
   * newest first, which the button shows as plain "Sort".
   */
  sort?: GridSort;
  /**
   * Where **Distance** measures from: a spot ("41.0534,-73.5387") or a Places value
   * ("city:Stamford"). Left out for Stamford, CT, and kept only while sorting by Distance.
   */
  near?: string;
  /** Set when the tiles are grouped by distance; kept only while sorting by Distance. */
  bands?: true;
  /** Set when each tile shows its distance; kept only while sorting by Distance. */
  distances?: true;
}

/**
 * Reads the grid's view, info and sort settings, the filters and the open photo from the URL,
 * leaving out the defaults.
 */
function validateGridSearch(
  search: Record<string, unknown>,
): GridSearch & PhotoFilters & CameraFilters & ShownPhotoSearch {
  return {
    ...gridViewOptions(search),
    ...parseColorFilters(search),
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseTextSearch(search),
    ...parseShownPhoto(search),
  };
}

/**
 * The Grid's own settings from the URL: its view, info, size, sort and Table settings, which are
 * remembered for the next time it's opened from another page. The filters aren't among them.
 */
function gridViewOptions(search: Record<string, unknown>): GridSearch {
  return {
    ...viewOf(search.view),
    ...parseTableSearch(search),
    ...infoOf(search),
    ...(search.ordered === false ? { ordered: false as const } : {}),
    ...parseGridSize(search.size),
    ...sortOf(search),
  };
}

/** The view from the URL, left out for square tiles. */
function viewOf(view: unknown): GridSearch {
  return view === "natural" || view === "table" ? { view } : {};
}

/** The sorts the URL can ask for by date, besides newest first, which have no order of their own. */
const DATE_SORTS: readonly string[] = ["newest", "oldest", "added", "time", "distance"];

/** The sorts the URL can ask for, including newest first once it's picked from **Sort**. */
const URL_SORTS: readonly string[] = ["newest", ...DATE_SORTS, "color", "vivid"];

/**
 * The sort from the URL, with its order: for a color sort its order and secondary sort, for
 * Recently Added, Time of Day and Distance the order when it's the way round from their default,
 * and for Distance where it measures from.
 */
function sortOf(search: Record<string, unknown>): GridSearch {
  if (!URL_SORTS.includes(search.sort as string)) return {};
  const sort = search.sort as GridSort;
  return isColorSort(sort)
    ? { sort, ...parseColorOrder(sort, search) }
    : {
        sort,
        ...parseDateOrder(sort, search.order),
        ...(sort === "distance" ? distanceOptions(search) : {}),
      };
}

/** Distance's spot, and whether its tiles are grouped and show their distances, from the URL. */
function distanceOptions(search: Record<string, unknown>): GridSearch {
  return {
    ...parseNear(search.near),
    ...(search.bands === true ? { bands: true as const } : {}),
    ...(search.distances === true ? { distances: true as const } : {}),
  };
}

/** Whether the sort is by color or vividness, rather than by a date. */
function isColorSort(sort: GridSort): sort is ColorSort {
  return !DATE_SORTS.includes(sort);
}

/** The info setting from the URL, which reads `info=true` and older `info=1` links alike. */
function infoOf(search: Record<string, unknown>): GridSearch {
  return search.info === true || search.info === 1 ? { info: true } : {};
}

export const Route = createFileRoute("/grid")({
  validateSearch: validateGridSearch,
  component: GridView,
});

// Newest first. Only photos with resized versions in R2 have images.
const newestFirst = allPhotos
  .filter((photo): photo is ImagePhoto => photo.image !== null)
  .toSorted((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

/** How the URL asks for the sort to run, with each default filled in. */
function colorSpec(search: GridSearch): GridColorSpec {
  const {
    order = defaultOrder(search.sort ?? "newest"),
    secondary,
    secondaryOrder = "asc",
    measure = "average",
    color,
  } = search;
  return { order, secondary, secondaryOrder, measure, color, near: distanceFrom(search) };
}

/** Where Distance measures from; Stamford, CT, unused, for the other sorts. */
function distanceFrom(search: GridSearch): Point {
  return search.sort === "distance" ? nearPoint(search.near, allPhotos) : DEFAULT_NEAR;
}

/** The photos the text search, the filters and the camera filters leave, before the colors. */
function searchedPhotos<T extends Photo>(list: T[], search: GridSearch & Record<string, unknown>) {
  return filterWithCamera(searchPhotos(list, search.q), search);
}

/** What every filter and the text search leave of the photos, in the same order. */
function filteredPhotos<T extends Photo>(list: T[], search: GridSearch & Record<string, unknown>) {
  return filterByColors(searchedPhotos(list, search), search);
}

/** The grid's photos: what every filter leaves, in the URL's sort. */
function gridPhotosFor(search: GridSearch & Record<string, unknown>, sort: GridSort): ImagePhoto[] {
  return sortGrid(filteredPhotos(newestFirst, search), sort, colorSpec(search));
}

function GridView() {
  const search = Route.useSearch();
  const mode: ViewMode = search.view ?? "square";
  useRememberViewOptions("/grid", gridViewOptions(search));
  if (newestFirst.length === 0) return <ViewPlaceholder to="/grid" />;
  const shownPhotos = photosFor(search, mode);

  return (
    // The tiles use the whole window, less a little padding, so wider screens fit more photos; the
    // header stays in the same centered column as the other pages.
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-1 sm:px-2">
        <SiteHomeLink className="basis-full" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Grid3x3 className="size-8 text-muted-foreground" aria-hidden />
          Grid
        </h1>
        <p className="text-sm text-muted-foreground">{shownPhotos.length} photos</p>
        <div className="ml-auto self-center">
          <ViewSwitcher choices={VIEW_MODES} mode={mode} />
        </div>
        <div className="mt-3 w-full">
          <CameraFilterBar
            photos={newestFirst}
            searchable
            end={mode !== "table" && <TileControls search={search} mode={mode} />}
          />
        </div>
      </header>
      <NoMatchingPhotos
        count={shownPhotos.length}
        className="mx-auto w-full max-w-6xl px-1 sm:px-2"
      />
      <GridBody mode={mode} photos={shownPhotos} search={search} />
    </div>
  );
}

/**
 * The photos the view shows: what every filter leaves, as tiles in the URL's sort, or for the
 * table, every photo (even those without resized versions in R2), which the table sorts itself.
 */
function photosFor(search: GridSearch & Record<string, unknown>, mode: ViewMode): Photo[] {
  if (mode === "table") return filteredPhotos(allPhotos, search);
  return gridPhotosFor(search, search.sort ?? "newest");
}

/** Whether a photo has resized versions in R2, so it can be a tile. */
function hasImage(photo: Photo): photo is ImagePhoto {
  return photo.image !== null;
}

/** The photos as tiles or a table, with the photo viewer for the one open. */
function GridBody({
  mode,
  photos,
  search,
}: {
  mode: ViewMode;
  photos: Photo[];
  search: GridSearch;
}) {
  const { shown, show, close } = useShownPhoto();
  if (mode === "table") {
    return (
      <PhotoTable
        photos={photos}
        search={search}
        size={tableSize(search.size)}
        shown={shown}
        onShow={show}
        onClose={close}
      />
    );
  }
  const tiles = photos.filter(hasImage);
  const tileProps = {
    mode,
    size: search.size,
    showInfo: search.info === true,
    ordered: search.ordered !== false,
    onOpen: show,
    badge: distanceBadge(search),
  };
  return (
    <>
      {search.sort === "distance" && search.bands ? (
        <DistanceBandTiles photos={tiles} from={distanceFrom(search)} {...tileProps} />
      ) : (
        <GridTiles photos={tiles} {...tileProps} />
      )}
      <PhotoLightbox photo={shown} photos={tiles} onShow={show} onClose={close} />
    </>
  );
}

/** Each tile's distance in words, while sorting by Distance with **Show distance** on. */
function distanceBadge(search: GridSearch): ((photo: Photo) => string | undefined) | undefined {
  if (search.sort !== "distance" || !search.distances) return undefined;
  const from = distanceFrom(search);
  return (photo) => photoDistanceText(photo, from);
}

/** Distance's display options from the URL, for **Display Options**. */
function distanceDisplay(search: GridSearch) {
  return { bands: search.bands === true, distances: search.distances === true };
}

/**
 * The tiles' **Sort**, the color sorts' **Then by**, Distance's **From**, and their **Display
 * Options**, at the right of the search row; the table has none of them.
 */
function TileControls({ search, mode }: { search: GridSearch; mode: TileMode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <GridSortControl sort={search.sort} order={colorSpec(search).order} />
      <ColorOrder sort={search.sort} search={search} />
      {search.sort === "distance" && <DistanceFromControl near={search.near} />}
      <GridViewOptions {...viewOptionsOf(search, mode)} align="end" />
    </div>
  );
}

/**
 * The tiles' display options from the URL: Natural's **Keep the order** and Distance's **Group by
 * distance** only where they apply.
 */
function viewOptionsOf(search: GridSearch, mode: TileMode) {
  const natural = mode === "natural";
  return {
    view: mode,
    size: natural ? naturalSize(search.size) : squareSize(search.size),
    info: search.info === true,
    ordered: natural ? search.ordered !== false : undefined,
    distance: search.sort === "distance" ? distanceDisplay(search) : undefined,
  };
}

/** The color or vividness sort's secondary sort, shown while the Grid is sorted by one. */
function ColorOrder({ sort, search }: { sort?: GridSort; search: GridSearch }) {
  if (sort !== "color" && sort !== "vivid") return null;
  const { secondary, secondaryOrder } = colorSpec(search);
  return (
    <ColorOrderControls
      sort={sort satisfies ColorSort}
      secondary={secondary}
      secondaryOrder={secondaryOrder}
    />
  );
}

/** The Grid's views: the two tile shapes and the table. */
const VIEW_MODES: ViewChoice<ViewMode>[] = [
  ...TILE_SHAPES,
  {
    mode: "table",
    label: "Table",
    title: "A sortable table of the photos and their details",
    Icon: Table,
  },
];
