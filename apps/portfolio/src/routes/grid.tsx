import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Grid3x3 } from "lucide-react";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";

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
            <PhotoTile photo={photo} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The thumbnail's size, which the pipeline makes square. */
const THUMBNAIL_SIZE = 500;

/**
 * The tiny image to show blurred while the tile's image loads: the thumbnail's own preview, which
 * matches its square, or else the photo's, for photos saved before they had one.
 */
function placeholderOf(image: PhotoImage) {
  return (image.thumbnail && image.thumbnailPreview) || image.preview;
}

function PhotoTile({ photo }: { photo: ImagePhoto }) {
  const { image } = photo;
  const placeholder = placeholderOf(image);

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        {placeholder && (
          // The blur-up placeholder, covered by the real image once it loads.
          <img
            src={placeholder}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover blur-md"
          />
        )}
        {image.thumbnail ? (
          // The square picked on the pipeline's Photo page, sharp at every tile size.
          <img
            src={image.thumbnail}
            width={THUMBNAIL_SIZE}
            height={THUMBNAIL_SIZE}
            alt={photo.title}
            loading="lazy"
            className="relative size-full object-cover"
          />
        ) : (
          // Photos saved before thumbnails show their middle.
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={TILE_SIZES}
            width={image.width}
            height={image.height}
            alt={photo.title}
            loading="lazy"
            className="relative size-full object-cover"
          />
        )}
      </div>
      <figcaption className="flex flex-col">
        <span className="truncate text-sm font-medium">{photo.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {format(photo.takenAt, "MMM d, yyyy")} · {photo.location}
        </span>
      </figcaption>
    </figure>
  );
}
