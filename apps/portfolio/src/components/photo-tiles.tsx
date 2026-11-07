import { type ImgHTMLAttributes, type ReactNode, useState } from "react";
import { ColorBar } from "@/components/color-bar";
import { NaturalGrid, NaturalRows } from "@/components/natural-grid";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLocation } from "@/components/photo-location";
import {
  type GridSize,
  NATURAL_ROW_SIZES,
  naturalSize,
  SQUARE_COLUMNS,
  SQUARE_TILE_SIZES,
  squareSize,
} from "@/lib/grid-size";
import { type NaturalRow, ratioOf, rowHeightOf, type RowSizes } from "@/lib/natural-rows";
import type { Photo, PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** A photo with resized versions in R2, which is all a tile can show. */
export type ImagePhoto = Photo & { image: PhotoImage };

/** How the tiles are shaped and how big they are, from the view and the Size option. */
interface TileSizes {
  mode: TileMode;
  /** How wide a Square tile is at each breakpoint, as an `<img sizes>`. */
  square: string;
  /** How big Natural rows start out. */
  rows: RowSizes;
}

/** The tiles' shape and sizes for the view and the Size option. */
function tileSizesOf(mode: TileMode, size: GridSize | undefined): TileSizes {
  return {
    mode,
    square: SQUARE_TILE_SIZES[squareSize(size)],
    rows: NATURAL_ROW_SIZES[naturalSize(size)],
  };
}

/** The photos as tiles: square ones in a grid, or natural ones in justified rows. */
export function GridTiles({
  photos,
  mode,
  size,
  showInfo,
  onOpen,
  rows,
}: {
  photos: ImagePhoto[];
  mode: TileMode;
  /** The URL's size, left out for each view's own starting size. */
  size: GridSize | undefined;
  showInfo: boolean;
  onOpen: (photo: ImagePhoto) => void;
  /**
   * The Natural rows to show, already laid out, such as Lucky's first few. Left out to lay out
   * every photo.
   */
  rows?: NaturalRow<ImagePhoto>[];
}) {
  const sizes = tileSizesOf(mode, size);
  const tile = (photo: ImagePhoto) => (
    <PhotoTile photo={photo} sizes={sizes} showInfo={showInfo} onOpen={() => onOpen(photo)} />
  );
  if (mode === "natural") {
    return (
      <NaturalTiles
        photos={photos}
        rows={rows}
        sizes={sizes.rows}
        showInfo={showInfo}
        renderTile={tile}
      />
    );
  }
  return (
    <ul
      className={cn(
        "grid",
        SQUARE_COLUMNS[squareSize(size)],
        showInfo ? "gap-x-3 gap-y-6" : "gap-3",
      )}
    >
      {photos.map((photo) => (
        <li key={photo.id} data-photo-id={photo.id}>
          {tile(photo)}
        </li>
      ))}
    </ul>
  );
}

/** Natural tiles: the rows given, or every photo laid out in rows of its own. */
function NaturalTiles({
  photos,
  rows,
  sizes,
  showInfo,
  renderTile,
}: {
  photos: ImagePhoto[];
  rows: NaturalRow<ImagePhoto>[] | undefined;
  sizes: RowSizes;
  showInfo: boolean;
  renderTile: (photo: ImagePhoto) => ReactNode;
}) {
  if (rows) return <NaturalRows rows={rows} showInfo={showInfo} renderTile={renderTile} />;
  return <NaturalGrid photos={photos} showInfo={showInfo} sizes={sizes} renderTile={renderTile} />;
}

/**
 * About how wide a natural tile is, for picking a sharp version: its starting width in its row
 * plus some room for growing to fill it, and never more than the window.
 */
function naturalSizes(photo: { image: PhotoImage }, rows: RowSizes): string {
  const width = Math.round(ratioOf(photo) * rowHeightOf(photo, rows) * 1.3);
  return `(max-width: ${width}px) 100vw, ${width}px`;
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
function sourcesOf(image: PhotoImage, sizes: TileSizes): ImgHTMLAttributes<HTMLImageElement>[] {
  const middle = {
    src: image.src,
    srcSet: image.srcSet,
    sizes: sizes.square,
    width: image.width,
    height: image.height,
  };
  if (sizes.mode === "natural") return [{ ...middle, sizes: naturalSizes({ image }, sizes.rows) }];
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
  sizes,
  showInfo,
  onOpen,
}: {
  photo: ImagePhoto;
  sizes: TileSizes;
  showInfo: boolean;
  onOpen: () => void;
}) {
  const { mode } = sizes;
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
        <TileImage key={`image-${mode}`} image={photo.image} sizes={sizes} alt={photo.alt} />
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
function TileImage({ image, sizes, alt }: { image: PhotoImage; sizes: TileSizes; alt: string }) {
  const fallback = useFallback();
  const [loaded, setLoaded] = useState(false);
  const source = sourcesOf(image, sizes)[fallback.index];
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

/**
 * How tiles are shaped: the square picked on the pipeline's Photo page, or the whole photo at its
 * own aspect ratio.
 */
export type TileMode = "square" | "natural";
