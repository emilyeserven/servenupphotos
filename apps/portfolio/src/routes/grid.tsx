import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Grid3x3, LayoutDashboard, Square, Table } from "lucide-react";
import { type ImgHTMLAttributes, useState } from "react";
import { ColorBar } from "@/components/color-bar";
import { ColorOrderControls } from "@/components/color-order-controls";
import { GridColorFilters } from "@/components/grid-color-filters";
import { GridSortSelect } from "@/components/grid-sort-select";
import { NaturalGrid } from "@/components/natural-grid";
import { PhotoTable } from "@/components/photo-table";
import { PhotoComment } from "@/components/photo-comment";
import { CameraFilterBar } from "@/components/camera-filters";
import { NoMatchingPhotos } from "@/components/photo-filters";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { PhotoLocation } from "@/components/photo-location";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { type CameraFilters, filterWithCamera, parseCameraFilters } from "@/lib/camera-filters";
import {
  COLOR_FILTER_KEYS,
  colorFilterCount,
  type ColorFilters,
  type ColorOrderSearch,
  filterByColors,
  parseColorFilters,
  parseColorOrder,
} from "@/lib/color-search";
import type { ColorSort } from "@/lib/color-sort";
import { type GridColorSpec, type GridSort, sortGrid } from "@/lib/grid-sort";
import { ratioOf, rowHeightOf } from "@/lib/natural-rows";
import { parseTableSearch, type TableSearch } from "@/lib/table-search";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

/**
 * How tiles are shaped: the square picked on the pipeline's Photo page, or the whole photo at its
 * own aspect ratio.
 */
type TileMode = "square" | "natural";

/** How the Grid shows its photos: as tiles of either shape, or as a table. */
type ViewMode = TileMode | "table";

interface GridSearch extends ColorFilters, ColorOrderSearch, TableSearch {
  /** Left out for the default, square tiles. */
  view?: Exclude<ViewMode, "square">;
  /** Set when each tile shows its title, place and comment under it. Left out for the default, hidden. */
  info?: true;
  /**
   * Set when the oldest or most recently added photo comes first, to sort by time of day, or to
   * sort by color or vividness. Left out for the
   * default, newest first.
   */
  sort?: Exclude<GridSort, "newest">;
}

/**
 * Reads the grid's view, info and sort settings, the filters and the open photo from the URL,
 * leaving out the defaults.
 */
function validateGridSearch(
  search: Record<string, unknown>,
): GridSearch & PhotoFilters & CameraFilters & ShownPhotoSearch {
  return {
    ...viewOf(search.view),
    ...parseTableSearch(search),
    ...infoOf(search),
    ...sortOf(search),
    ...parseColorFilters(search),
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseShownPhoto(search),
  };
}

/** The view from the URL, left out for square tiles. */
function viewOf(view: unknown): GridSearch {
  return view === "natural" || view === "table" ? { view } : {};
}

/** The sorts the URL can ask for by date, besides newest first, which have no order of their own. */
const DATE_SORTS: readonly string[] = ["oldest", "added", "time"];

/** The sorts the URL can ask for, besides newest first. */
const URL_SORTS: readonly string[] = [...DATE_SORTS, "color", "vivid"];

/** The sort from the URL, with the color sorts' order and secondary sort when it's one of them. */
function sortOf(search: Record<string, unknown>): GridSearch {
  if (!URL_SORTS.includes(search.sort as string)) return {};
  const sort = search.sort as Exclude<GridSort, "newest">;
  return isColorSort(sort) ? { sort, ...parseColorOrder(sort, search) } : { sort };
}

/** Whether the sort is by color or vividness, rather than by a date. */
function isColorSort(sort: Exclude<GridSort, "newest">): sort is ColorSort {
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

/** A photo with resized versions in R2, which is all the grid can show. */
type ImagePhoto = Photo & { image: PhotoImage };

// Newest first. Only photos with resized versions in R2 have images.
const newestFirst = photos
  .filter((photo): photo is ImagePhoto => photo.image !== null)
  .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

/** How the URL asks for the color or vividness sort to run, with each default filled in. */
function colorSpec(search: GridSearch): GridColorSpec {
  const { order = "asc", secondary, secondaryOrder = "asc", measure = "average", color } = search;
  return { order, secondary, secondaryOrder, measure, color };
}

/** The grid's photos: what every filter leaves, in the URL's sort. */
function gridPhotosFor(search: GridSearch & Record<string, unknown>, sort: GridSort): ImagePhoto[] {
  const filtered = filterByColors(filterWithCamera(newestFirst, search), search);
  return sortGrid(filtered, sort, colorSpec(search));
}

// How wide a tile is at each breakpoint, matching the grid's columns, so the browser picks the
// smallest version that's still sharp.
const TILE_SIZES =
  "(min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

function GridView() {
  const search = Route.useSearch();
  const mode: ViewMode = search.view ?? "square";
  if (newestFirst.length === 0) return <ViewPlaceholder to="/grid" />;
  const shownPhotos = photosFor(search, mode);

  return (
    // The tiles use the whole window, less a little padding, so wider screens fit more photos; the
    // header stays in the same centered column as the other pages.
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-1 sm:px-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Grid3x3 className="size-8 text-muted-foreground" aria-hidden />
          Grid
        </h1>
        <p className="text-sm text-muted-foreground">{shownPhotos.length} photos</p>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 self-center">
          {mode !== "table" && <TileControls search={search} />}
          <ViewModeSwitcher mode={mode} />
        </div>
        <div className="mt-3 w-full">
          <CameraFilterBar
            photos={newestFirst}
            extra={{
              keys: COLOR_FILTER_KEYS,
              count: colorFilterCount(search),
              children: (
                <GridColorFilters photos={filterWithCamera(newestFirst, search)} filters={search} />
              ),
            }}
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
  if (mode === "table") return filterByColors(filterWithCamera(photos, search), search);
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
      <PhotoTable photos={photos} search={search} shown={shown} onShow={show} onClose={close} />
    );
  }
  const tiles = photos.filter(hasImage);
  return (
    <>
      <GridTiles photos={tiles} mode={mode} showInfo={search.info === true} onOpen={show} />
      <PhotoLightbox photo={shown} photos={tiles} onShow={show} onClose={close} />
    </>
  );
}

/** The tiles' sort, its color order and the Show info toggle, which the table doesn't use. */
function TileControls({ search }: { search: GridSearch }) {
  const sort: GridSort = search.sort ?? "newest";
  return (
    <>
      <GridSortSelect sort={sort} />
      <ColorOrder sort={sort} search={search} />
      <InfoToggle shown={search.info === true} />
    </>
  );
}

/** The photos as tiles: square ones in a grid, or natural ones in justified rows. */
function GridTiles({
  photos,
  mode,
  showInfo,
  onOpen,
}: {
  photos: ImagePhoto[];
  mode: TileMode;
  showInfo: boolean;
  onOpen: (photo: ImagePhoto) => void;
}) {
  const tile = (photo: ImagePhoto) => (
    <PhotoTile photo={photo} mode={mode} showInfo={showInfo} onOpen={() => onOpen(photo)} />
  );
  if (mode === "natural") {
    return <NaturalGrid photos={photos} showInfo={showInfo} renderTile={tile} />;
  }
  return (
    <ul className={showInfo ? SQUARE_INFO_CLASS : SQUARE_CLASS}>
      {photos.map((photo) => (
        <li key={photo.id}>{tile(photo)}</li>
      ))}
    </ul>
  );
}

/** The color or vividness sort's order and secondary sort, shown while the Grid is sorted by one. */
function ColorOrder({ sort, search }: { sort: GridSort; search: GridSearch }) {
  if (sort !== "color" && sort !== "vivid") return null;
  const { order, secondary, secondaryOrder } = colorSpec(search);
  return (
    <ColorOrderControls
      sort={sort satisfies ColorSort}
      order={order}
      secondary={secondary}
      secondaryOrder={secondaryOrder}
    />
  );
}

/**
 * About how wide a natural tile is, for picking a sharp version: its starting width in its row
 * plus some room for growing to fill it, and never more than the window.
 */
function naturalSizes(photo: { image: PhotoImage }): string {
  const width = Math.round(ratioOf(photo) * rowHeightOf(photo) * 1.3);
  return `(max-width: ${width}px) 100vw, ${width}px`;
}

/** The square tiles' grid; rows sit further apart when tiles show their captions. */
const SQUARE_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
const SQUARE_INFO_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

const VIEW_MODES = [
  { mode: "square", label: "Square", title: "Square thumbnails", Icon: Square },
  {
    mode: "natural",
    label: "Natural",
    title: "Each photo at its own aspect ratio",
    Icon: LayoutDashboard,
  },
  {
    mode: "table",
    label: "Table",
    title: "A sortable table of the photos and their details",
    Icon: Table,
  },
] as const;

/**
 * A checkbox to show or hide each tile's title and comment, kept in the URL so a link keeps it.
 * Hidden by default, so the grid is only photos.
 */
function InfoToggle({ shown }: { shown: boolean }) {
  const navigate = useNavigate({ from: "/grid" });
  return (
    <label
      title="Show each photo's title, place and comment under it"
      className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground select-none hover:text-foreground"
    >
      <input
        type="checkbox"
        checked={shown}
        onChange={(event) => {
          const info = event.target.checked ? true : undefined;
          void navigate({ search: (prev) => ({ ...prev, info }), replace: true });
        }}
        className="size-4 cursor-pointer accent-primary"
      />
      Show info
    </label>
  );
}

/** Buttons to switch between square tiles, natural tiles and the table, kept in the URL so a link keeps the view. */
function ViewModeSwitcher({ mode }: { mode: ViewMode }) {
  return (
    <div role="group" aria-label="Show photos as" className={CONTROL_FRAME}>
      {VIEW_MODES.map(({ mode: option, label, title, Icon }) => (
        <Link
          key={option}
          from="/grid"
          to="/grid"
          search={(prev) => ({ ...prev, view: option === "square" ? undefined : option })}
          replace
          aria-pressed={mode === option}
          title={title}
          className={controlButtonClass(mode === option)}
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}

/** The thumbnail's size, which the pipeline makes square. */
const THUMBNAIL_SIZE = 500;

/**
 * The tiny images to show blurred while the tile's image loads, or in its place when it can't:
 * the thumbnail's own preview, which matches its square, then the photo's, for photos saved before
 * they had one or when the thumbnail's preview won't load.
 */
function placeholdersOf(image: PhotoImage, mode: TileMode): string[] {
  const square = mode === "square" && image.thumbnail ? [image.thumbnailPreview] : [];
  return [...square, image.preview].filter((url): url is string => Boolean(url));
}

/**
 * What the tile shows, best first. Square tiles show the square picked on the pipeline's Photo
 * page, sharp at every tile size, then the middle of the resized versions, for photos saved before
 * thumbnails or when the thumbnail won't load. Natural tiles pick from the resized versions by how
 * wide the tile is, since at a row's height or taller the Small version is too soft.
 */
function sourcesOf(image: PhotoImage, mode: TileMode): ImgHTMLAttributes<HTMLImageElement>[] {
  const middle = {
    src: image.src,
    srcSet: image.srcSet,
    sizes: TILE_SIZES,
    width: image.width,
    height: image.height,
  };
  if (mode === "natural") return [{ ...middle, sizes: naturalSizes({ image }) }];
  if (!image.thumbnail) return [middle];
  return [{ src: image.thumbnail, width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }, middle];
}

/** The index of the first of a list of images that hasn't failed to load, moved on by `next`. */
function useFallback() {
  const [index, setIndex] = useState(0);
  return { index, next: () => setIndex((i) => i + 1) };
}

/** Whether img has already loaded, as a cached image can before React listens for it. */
function isLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

function PhotoTile({
  photo,
  mode,
  showInfo,
  onOpen,
}: {
  photo: ImagePhoto;
  mode: TileMode;
  showInfo: boolean;
  onOpen: () => void;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <button
        type="button"
        title="Show the whole photo"
        onClick={onOpen}
        style={mode === "natural" ? { aspectRatio: photo.image.width / photo.image.height } : {}}
        className={cn(
          "relative block w-full cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          mode === "square" && "aspect-square",
        )}
      >
        {/* Keyed by mode so switching starts each image's fallbacks over. */}
        <TilePlaceholder key={`placeholder-${mode}`} image={photo.image} mode={mode} />
        <TileImage key={`image-${mode}`} image={photo.image} mode={mode} alt={photo.title} />
      </button>
      {showInfo && <TileCaption photo={photo} />}
    </figure>
  );
}

/** The title, place and comment under a tile, shown when the grid's Info toggle is on. */
function TileCaption({ photo }: { photo: ImagePhoto }) {
  return (
    <figcaption className="flex flex-col">
      <span className="truncate text-sm font-medium">{photo.title}</span>
      {photo.location && (
        <PhotoLocation
          location={photo.location}
          className="w-fit max-w-full truncate text-xs text-muted-foreground"
        />
      )}
      {photo.palette.length > 0 && <ColorBar palette={photo.palette} />}
      {/* The rest of its details are in the lightbox. */}
      {photo.comment && (
        <PhotoComment comment={photo.comment} className="text-xs text-muted-foreground" />
      )}
    </figcaption>
  );
}

/** The blurred placeholder, under the tile's image, trying the next one when one won't load. */
function TilePlaceholder({ image, mode }: { image: PhotoImage; mode: TileMode }) {
  const fallback = useFallback();
  const src = placeholdersOf(image, mode)[fallback.index];
  if (!src) return null;
  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={fallback.next}
      className="absolute inset-0 size-full scale-110 object-cover blur-md"
    />
  );
}

/**
 * The tile's image, fading in over the placeholder once it loads. When none of its sources load,
 * nothing covers the placeholder, so the tile stays blurred rather than showing a broken image.
 */
function TileImage({ image, mode, alt }: { image: PhotoImage; mode: TileMode; alt: string }) {
  const fallback = useFallback();
  const [loaded, setLoaded] = useState(false);
  const source = sourcesOf(image, mode)[fallback.index];
  if (!source) return null;
  return (
    <img
      key={source.src}
      {...source}
      ref={(img) => {
        if (isLoaded(img)) setLoaded(true);
      }}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(false);
        fallback.next();
      }}
      className={cn(
        "relative size-full object-cover transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
