import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Grid3x3, LayoutDashboard, Square } from "lucide-react";
import { type CSSProperties, type ImgHTMLAttributes, useState } from "react";
import { type GridSort, GridSortSelect } from "@/components/grid-sort-select";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { PhotoLocation } from "@/components/photo-location";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * How tiles are shaped: the square picked on the pipeline's Photo page, or the whole photo at its
 * own aspect ratio.
 */
type ViewMode = "square" | "natural";

interface GridSearch {
  /** Left out for the default, square tiles. */
  view?: "natural";
  /** Set when each tile shows its title, place and comment under it. Left out for the default, hidden. */
  info?: true;
  /** Set when the oldest photo comes first. Left out for the default, newest first. */
  sort?: "oldest";
}

/** Reads the grid's view, info and sort settings from the URL, leaving out the defaults. */
function validateGridSearch(search: Record<string, unknown>): GridSearch {
  const view: GridSearch = search.view === "natural" ? { view: "natural" } : {};
  const sort: GridSearch = search.sort === "oldest" ? { sort: "oldest" } : {};
  return { ...view, ...infoOf(search), ...sort };
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

/** The grid's photos in each sort order, worked out once. */
const SORTED: Record<GridSort, ImagePhoto[]> = {
  newest: newestFirst,
  oldest: newestFirst.toReversed(),
};

// How wide a tile is at each breakpoint, matching the grid's columns, so the browser picks the
// smallest version that's still sharp.
const TILE_SIZES =
  "(min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

function GridView() {
  const [shown, setShown] = useState<ImagePhoto | null>(null);
  const search = Route.useSearch();
  const mode: ViewMode = search.view ?? "square";
  const showInfo = search.info === true;
  const sort: GridSort = search.sort ?? "newest";
  const gridPhotos = SORTED[sort];
  if (gridPhotos.length === 0) return <ViewPlaceholder to="/grid" />;

  return (
    // The tiles use the whole window, less a little padding, so wider screens fit more photos; the
    // header stays in the same centered column as the other pages.
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-1 sm:px-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Grid3x3 className="size-8 text-muted-foreground" aria-hidden />
          Grid
        </h1>
        <p className="text-sm text-muted-foreground">{gridPhotos.length} photos</p>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 self-center">
          <GridSortSelect sort={sort} />
          <InfoToggle shown={showInfo} />
          <ViewModeSwitcher mode={mode} />
        </div>
      </header>
      {/* Natural tiles sit in justified rows: each starts NATURAL_MIN_HEIGHT tall at its own
          aspect ratio, and a row's tiles grow together to fill its width, so they only get taller. */}
      <ul className={listClass(mode, showInfo)}>
        {gridPhotos.map((photo) => (
          <li key={photo.id} style={mode === "natural" ? naturalTileStyle(photo.image) : {}}>
            <PhotoTile
              photo={photo}
              mode={mode}
              showInfo={showInfo}
              onOpen={() => setShown(photo)}
            />
          </li>
        ))}
      </ul>
      <PhotoLightbox
        photo={shown}
        photos={gridPhotos}
        onShow={setShown}
        onClose={() => setShown(null)}
      />
    </div>
  );
}

/** How tall a natural tile is at least, where the window is wide enough for it. */
const NATURAL_MIN_HEIGHT = 250;

/**
 * A natural tile's place in its row: as wide as NATURAL_MIN_HEIGHT makes it, then growing with its
 * aspect ratio so every tile in a row stays the same height. On a phone a wide photo can be wider
 * than the screen, so it shrinks to the screen's width and is shorter than that.
 */
function naturalTileStyle(image: PhotoImage): CSSProperties {
  const ratio = image.width / image.height;
  return { flexGrow: ratio, flexBasis: ratio * NATURAL_MIN_HEIGHT, minWidth: 0 };
}

/**
 * About how wide a natural tile is, for picking a sharp version: its starting width plus some room
 * for growing to fill its row, and never more than the window.
 */
function naturalSizes(image: PhotoImage): string {
  const width = Math.round((image.width / image.height) * NATURAL_MIN_HEIGHT * 1.3);
  return `(max-width: ${width}px) 100vw, ${width}px`;
}

/**
 * The list's layout: a grid of squares, or justified rows for natural tiles. Rows sit further
 * apart when tiles show their captions.
 */
function listClass(mode: ViewMode, showInfo: boolean): string {
  return LIST_CLASSES[mode][showInfo ? "info" : "bare"];
}

const LIST_CLASSES = {
  square: {
    info: "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    bare: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  },
  natural: {
    // The stretchy last item keeps the last row's tiles from growing to fill it on their own.
    info: "flex flex-wrap gap-x-3 gap-y-6 after:grow-[1000000] after:content-['']",
    bare: "flex flex-wrap gap-3 after:grow-[1000000] after:content-['']",
  },
} as const;

const VIEW_MODES = [
  { mode: "square", label: "Square", Icon: Square },
  { mode: "natural", label: "Natural", Icon: LayoutDashboard },
] as const;

/** The outline around the tile shape switcher. */
const CONTROL_FRAME =
  "inline-flex rounded-md border bg-background p-0.5 shadow-xs dark:border-input dark:bg-input/30";

/** How one of the controls' buttons looks, depending on whether it's on. */
function controlButtonClass(active: boolean): string {
  return cn(
    "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

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

/** Buttons to switch between square and natural tiles, kept in the URL so a link keeps the view. */
function ViewModeSwitcher({ mode }: { mode: ViewMode }) {
  return (
    <div role="group" aria-label="Tile shape" className={CONTROL_FRAME}>
      {VIEW_MODES.map(({ mode: option, label, Icon }) => (
        <Link
          key={option}
          from="/grid"
          to="/grid"
          search={(prev) => ({ ...prev, view: option === "natural" ? "natural" : undefined })}
          replace
          aria-pressed={mode === option}
          title={option === "square" ? "Square thumbnails" : "Each photo at its own aspect ratio"}
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
function placeholdersOf(image: PhotoImage, mode: ViewMode): string[] {
  const square = mode === "square" && image.thumbnail ? [image.thumbnailPreview] : [];
  return [...square, image.preview].filter((url): url is string => Boolean(url));
}

/**
 * What the tile shows, best first. Square tiles show the square picked on the pipeline's Photo
 * page, sharp at every tile size, then the middle of the resized versions, for photos saved before
 * thumbnails or when the thumbnail won't load. Natural tiles pick from the resized versions by how
 * wide the tile is, since at NATURAL_MIN_HEIGHT or taller the Small version is too soft.
 */
function sourcesOf(image: PhotoImage, mode: ViewMode): ImgHTMLAttributes<HTMLImageElement>[] {
  const middle = {
    src: image.src,
    srcSet: image.srcSet,
    sizes: TILE_SIZES,
    width: image.width,
    height: image.height,
  };
  if (mode === "natural") return [{ ...middle, sizes: naturalSizes(image) }];
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
  mode: ViewMode;
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
      {/* The rest of its details are in the lightbox. */}
      {photo.comment && (
        <PhotoComment comment={photo.comment} className="text-xs text-muted-foreground" />
      )}
    </figcaption>
  );
}

/** The blurred placeholder, under the tile's image, trying the next one when one won't load. */
function TilePlaceholder({ image, mode }: { image: PhotoImage; mode: ViewMode }) {
  const fallback = useFallback();
  const src = placeholdersOf(image, mode)[fallback.index];
  if (!src) return null;
  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden
      onError={fallback.next}
      className="absolute inset-0 size-full scale-110 object-cover blur-md"
    />
  );
}

/**
 * The tile's image, fading in over the placeholder once it loads. When none of its sources load,
 * nothing covers the placeholder, so the tile stays blurred rather than showing a broken image.
 */
function TileImage({ image, mode, alt }: { image: PhotoImage; mode: ViewMode; alt: string }) {
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
