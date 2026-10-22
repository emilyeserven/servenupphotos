import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Grid3x3 } from "lucide-react";
import { type ImgHTMLAttributes, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/grid")({
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
  if (gridPhotos.length === 0) return <ViewPlaceholder to="/grid" />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Grid3x3 className="size-8 text-muted-foreground" aria-hidden />
          Grid
        </h1>
        <p className="text-sm text-muted-foreground">{gridPhotos.length} photos</p>
      </header>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {gridPhotos.map((photo) => (
          <li key={photo.id}>
            <PhotoTile photo={photo} onOpen={() => setShown(photo)} />
          </li>
        ))}
      </ul>
      <PhotoLightbox photo={shown} onClose={() => setShown(null)} />
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
function placeholdersOf(image: PhotoImage): string[] {
  const square = image.thumbnail ? [image.thumbnailPreview] : [];
  return [...square, image.preview].filter((url): url is string => Boolean(url));
}

/**
 * What the tile shows, best first: the square picked on the pipeline's Photo page, sharp at every
 * tile size, then the middle of the resized versions, for photos saved before thumbnails or when
 * the thumbnail won't load.
 */
function sourcesOf(image: PhotoImage): ImgHTMLAttributes<HTMLImageElement>[] {
  const middle = {
    src: image.src,
    srcSet: image.srcSet,
    sizes: TILE_SIZES,
    width: image.width,
    height: image.height,
  };
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

function PhotoTile({ photo, onOpen }: { photo: ImagePhoto; onOpen: () => void }) {
  return (
    <figure className="flex flex-col gap-2">
      <button
        type="button"
        title="Show the whole photo"
        onClick={onOpen}
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <TilePlaceholder image={photo.image} />
        <TileImage image={photo.image} alt={photo.title} />
      </button>
      <figcaption className="flex flex-col">
        <span className="truncate text-sm font-medium">{photo.title}</span>
        {photo.comment && (
          <PhotoComment comment={photo.comment} className="text-xs text-foreground/80" />
        )}
        <span className="truncate text-xs text-muted-foreground">
          {format(photo.takenAt, "MMM d, yyyy")} · {photo.location}
        </span>
      </figcaption>
    </figure>
  );
}

/** The blurred placeholder, under the tile's image, trying the next one when one won't load. */
function TilePlaceholder({ image }: { image: PhotoImage }) {
  const fallback = useFallback();
  const src = placeholdersOf(image)[fallback.index];
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
function TileImage({ image, alt }: { image: PhotoImage; alt: string }) {
  const fallback = useFallback();
  const [loaded, setLoaded] = useState(false);
  const source = sourcesOf(image)[fallback.index];
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
