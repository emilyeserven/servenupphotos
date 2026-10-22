import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid3x3, LayoutDashboard, Square } from "lucide-react";
import { type ImgHTMLAttributes, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ViewPlaceholder } from "@/components/view-placeholder";
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
}

export const Route = createFileRoute("/grid")({
  validateSearch: (search: Record<string, unknown>): GridSearch =>
    search.view === "natural" ? { view: "natural" } : {},
  component: GridView,
});

/** A photo with resized versions in R2, which is all the grid can show. */
type ImagePhoto = Photo & { image: PhotoImage };

// Newest first. Only photos from ALLPHOTOS.local.json have images; the dummy data has none.
const gridPhotos = photos
  .filter((photo): photo is ImagePhoto => photo.image !== null)
  .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

// How wide a tile is at each breakpoint, matching the grid's columns, so the browser picks the
// smallest version that's still sharp.
const TILE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

function GridView() {
  const [shown, setShown] = useState<ImagePhoto | null>(null);
  const mode: ViewMode = Route.useSearch().view ?? "square";
  if (gridPhotos.length === 0) return <ViewPlaceholder to="/grid" />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Grid3x3 className="size-8 text-muted-foreground" aria-hidden />
          Grid
        </h1>
        <p className="text-sm text-muted-foreground">{gridPhotos.length} photos</p>
        <ViewModeSwitcher mode={mode} />
      </header>
      {/* Natural tiles are stacked in columns, masonry style, so tiles of different heights don't
          leave gaps. That fills each column top to bottom, so newest first reads down, not across. */}
      <ul
        className={cn(
          mode === "square"
            ? "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4"
            : "columns-2 gap-x-3 sm:columns-3 lg:columns-4",
        )}
      >
        {gridPhotos.map((photo) => (
          <li key={photo.id} className={cn(mode === "natural" && "mb-6 break-inside-avoid")}>
            <PhotoTile photo={photo} mode={mode} onOpen={() => setShown(photo)} />
          </li>
        ))}
      </ul>
      <PhotoLightbox photo={shown} onClose={() => setShown(null)} />
    </div>
  );
}

const VIEW_MODES = [
  { mode: "square", label: "Square", Icon: Square },
  { mode: "natural", label: "Natural", Icon: LayoutDashboard },
] as const;

/** Buttons to switch between square and natural tiles, kept in the URL so a link keeps the view. */
function ViewModeSwitcher({ mode }: { mode: ViewMode }) {
  return (
    <div
      role="group"
      aria-label="Tile shape"
      className="ml-auto inline-flex self-center rounded-md border bg-background p-0.5 shadow-xs dark:border-input dark:bg-input/30"
    >
      {VIEW_MODES.map(({ mode: option, label, Icon }) => (
        <Link
          key={option}
          to="/grid"
          search={option === "natural" ? { view: "natural" } : {}}
          replace
          aria-pressed={mode === option}
          title={option === "square" ? "Square thumbnails" : "Each photo at its own aspect ratio"}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
            mode === option
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
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
 * thumbnails or when the thumbnail won't load. Natural tiles show the Small version, then the
 * middle one when Small won't load.
 */
function sourcesOf(image: PhotoImage, mode: ViewMode): ImgHTMLAttributes<HTMLImageElement>[] {
  const middle = {
    src: image.src,
    srcSet: image.srcSet,
    sizes: TILE_SIZES,
    width: image.width,
    height: image.height,
  };
  if (mode === "natural") {
    const small = { src: image.small, width: image.width, height: image.height };
    return image.small === image.src ? [middle] : [small, middle];
  }
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
  onOpen,
}: {
  photo: ImagePhoto;
  mode: ViewMode;
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
      <figcaption className="flex flex-col">
        <span className="truncate text-sm font-medium">{photo.title}</span>
        {/* The rest of its details are in the lightbox. */}
        {photo.comment && (
          <PhotoComment comment={photo.comment} className="text-xs text-muted-foreground" />
        )}
      </figcaption>
    </figure>
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
