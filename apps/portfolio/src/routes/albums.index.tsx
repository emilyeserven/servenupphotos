import { createFileRoute } from "@tanstack/react-router";
import { BookImage } from "lucide-react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { AlbumStrip } from "@/components/album-strip";
import { SiteHomeLink } from "@/components/site-home-link";
import { coverPhotos } from "@/lib/album-layout";
import { albums, albumShown, albumTree } from "@/lib/groups";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { albumPhotos, newestWithImages } from "@/lib/spotlight-zones";
import { TripStrip } from "@/components/trip-strip";
import { photos as allPhotos } from "@/lib/photos";
import { shownPhotos, storyDays, type TripPage, tripPages } from "@/lib/trip-pages";
import type { ImagePhoto } from "@/lib/spotlight-zones";

export const Route = createFileRoute("/albums/")({
  validateSearch: (search: Record<string, unknown>): ShownPhotoSearch => parseShownPhoto(search),
  component: AlbumsView,
});

// Worked out once: the photos only change with a new build. Albums without photos, and hidden
// ones, are left out.
const strips = albumTree()
  .filter((album) => albumShown(album.id))
  .map((album) => ({
    album,
    parent: albums.find((other) => other.id === album.parent),
    photos: albumPhotos(album.id),
  }))
  .filter((strip) => strip.photos.length > 0);
// The Trip pages with photos, each with the photos it shows, in order.
const withImages = newestWithImages(allPhotos);
const trips = tripPages
  .map((page) => ({ page, photos: shownPhotos(storyDays(page, withImages)) }))
  .filter((trip) => trip.photos.length > 0);
// Every photo shown in a strip once, for the lightbox to step through.
const allInAlbums = [
  ...new Map(
    [
      ...strips.flatMap((s) => coverPhotos(s.album, s.photos)),
      ...trips.flatMap((t) => t.photos.slice(0, 5)),
    ].map((p) => [p.id, p]),
  ).values(),
];

/**
 * Each album, in the order set on the pipeline, with a strip of its photos and its sub-albums',
 * linked to its own page.
 */
function AlbumsView() {
  const { shown, show, close } = useShownPhoto();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header>
        <SiteHomeLink className="mb-1" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <BookImage className="size-8 text-muted-foreground" aria-hidden />
          Albums
        </h1>
        <p className="mt-2 text-muted-foreground">
          A few photos from each album. Open one to see them all, full size.
        </p>
      </header>
      {strips.length === 0 && trips.length === 0 && (
        <p className="text-muted-foreground">No albums have photos yet.</p>
      )}
      {strips.map(({ album, parent, photos }) => (
        <AlbumStrip key={album.id} album={album} parent={parent} photos={photos} onOpen={show} />
      ))}
      <TripStrips trips={trips} onOpen={show} />
      <PhotoLightbox photo={shown} photos={allInAlbums} onShow={show} onClose={close} />
    </div>
  );
}

/**
 * The Trip pages, newest first, under their own heading after the albums: each Trip's story,
 * written day by day on the pipeline's Trip Lines page.
 */
function TripStrips({
  trips: shown,
  onOpen,
}: {
  trips: { page: TripPage; photos: ImagePhoto[] }[];
  onOpen: (photo: ImagePhoto) => void;
}) {
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="trips" className="flex flex-col gap-10">
      <div>
        <h2 id="trips" className="text-2xl font-semibold tracking-tight">
          Trips
        </h2>
        <p className="mt-1 text-muted-foreground">The story of each trip, day by day.</p>
      </div>
      {shown.map(({ page, photos }) => (
        <TripStrip key={page.id} page={page} photos={photos} onOpen={onOpen} />
      ))}
    </section>
  );
}
