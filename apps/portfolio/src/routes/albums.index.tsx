import { createFileRoute } from "@tanstack/react-router";
import { BookImage } from "lucide-react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { AlbumStrip, previewPhotos } from "@/components/album-strip";
import { albums, albumTree } from "@/lib/groups";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { albumPhotos } from "@/lib/spotlight-zones";

export const Route = createFileRoute("/albums/")({
  validateSearch: (search: Record<string, unknown>): ShownPhotoSearch => parseShownPhoto(search),
  component: AlbumsView,
});

// Worked out once: the photos only change with a new build. Albums without photos are left out.
const strips = albumTree()
  .map((album) => ({
    album,
    parent: albums.find((other) => other.id === album.parent),
    photos: albumPhotos(album.id),
  }))
  .filter((strip) => strip.photos.length > 0);
// Every photo shown in a strip once, for the lightbox to step through.
const allInAlbums = [
  ...new Map(strips.flatMap((s) => previewPhotos(s.photos)).map((p) => [p.id, p])).values(),
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
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <BookImage className="size-8 text-muted-foreground" aria-hidden />
          Albums
        </h1>
        <p className="mt-2 text-muted-foreground">
          A few photos from each album. Open one to see them all, full size.
        </p>
      </header>
      {strips.length === 0 && <p className="text-muted-foreground">No albums have photos yet.</p>}
      {strips.map(({ album, parent, photos }) => (
        <AlbumStrip key={album.id} album={album} parent={parent} photos={photos} onOpen={show} />
      ))}
      <PhotoLightbox photo={shown} photos={allInAlbums} onShow={show} onClose={close} />
    </div>
  );
}
