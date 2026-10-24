import type { Group } from "@/lib/groups";
import { albumSpots, type ImagePhoto } from "@/lib/spotlight-zones";

/**
 * One album's photos as a strip, newest first, each at its own shape and scrolling sideways when
 * they don't fit, under its name, the album it's in, its description and where else on the site
 * it shows. Clicking a photo opens it.
 */
export function AlbumStrip({
  album,
  parent,
  photos,
  onOpen,
}: {
  album: Group;
  /** The album it's a sub-album of, if any. */
  parent?: Group;
  photos: ImagePhoto[];
  onOpen: (photo: ImagePhoto) => void;
}) {
  return (
    <section aria-labelledby={`album-${album.id}`} className="flex flex-col gap-3">
      <div>
        <h2 id={`album-${album.id}`} className="text-xl font-semibold tracking-tight">
          {parent && <span className="text-muted-foreground">{parent.name} › </span>}
          {album.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {album.description} {photos.length} {photos.length === 1 ? "photo" : "photos"}.
          <SpotsNote album={album} />
        </p>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        {photos.map((photo) => (
          <li key={photo.id} className="shrink-0 snap-start">
            <StripPhoto photo={photo} onOpen={() => onOpen(photo)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** " Also shown on the homepage." for an album a spotlight zone shows, or nothing. */
function SpotsNote({ album }: { album: Group }) {
  const spots = albumSpots(album);
  if (spots.length === 0) return null;
  return <> Also shown on {spots.join(" and ")}.</>;
}

/** A photo in the strip, as tall as the strip and as wide as its shape makes it. */
function StripPhoto({ photo, onOpen }: { photo: ImagePhoto; onOpen: () => void }) {
  const { width, height, small, srcSet } = photo.image;
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className="block h-48 cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-64"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={small}
        srcSet={srcSet}
        sizes="(min-width: 640px) 400px, 300px"
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    </button>
  );
}
