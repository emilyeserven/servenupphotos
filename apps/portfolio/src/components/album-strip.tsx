import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { coverPhotos } from "@/lib/album-layout";
import type { Group } from "@/lib/groups";
import { albumSpots, type ImagePhoto } from "@/lib/spotlight-zones";

/**
 * One album's covers, or else its first 5 photos, as a strip, in order, each at its own shape and scrolling
 * sideways when they don't fit, under its name, linked to the album's page, the album it's in, its
 * description, how many photos it has and where else on the site it shows. Clicking a photo opens
 * it; with more photos than it shows, a link at the end opens the album's page.
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
  const shown = coverPhotos(album, photos);
  return (
    <section aria-labelledby={`album-${album.id}`} className="flex flex-col gap-3">
      <div>
        <h2 id={`album-${album.id}`} className="text-xl font-semibold tracking-tight">
          {parent && <span className="text-muted-foreground">{parent.name} › </span>}
          <Link
            to="/albums/$id"
            params={{ id: album.id }}
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
          >
            {album.name}
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {album.description} {photos.length} {photos.length === 1 ? "photo" : "photos"}.
          <SpotsNote album={album} />
        </p>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        {shown.map((photo) => (
          <li key={photo.id} className="shrink-0 snap-start">
            <StripPhoto photo={photo} onOpen={() => onOpen(photo)} />
          </li>
        ))}
        <SeeAll album={album} count={photos.length} shown={shown.length} />
      </ul>
    </section>
  );
}

/** The link at the end of the strip to the album's page, when it has more photos than it shows. */
function SeeAll({ album, count, shown }: { album: Group; count: number; shown: number }) {
  if (count <= shown) return null;
  return (
    <li className="shrink-0 snap-start">
      <Link
        to="/albums/$id"
        params={{ id: album.id }}
        className="flex h-48 w-40 flex-col items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted sm:h-64"
      >
        <ArrowRight className="size-5" aria-hidden />
        See all {count} photos
      </Link>
    </li>
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
