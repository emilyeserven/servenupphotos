import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { FittedPhoto } from "@/components/fitted-photo";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { albums, type Group } from "@/lib/groups";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { albumPhotos } from "@/lib/spotlight-zones";

export const Route = createFileRoute("/albums/$id")({
  validateSearch: (search: Record<string, unknown>): ShownPhotoSearch => parseShownPhoto(search),
  component: AlbumView,
});

/** One album's page: its first photos as large as they fit, then a link to show every one. */
function AlbumView() {
  const { id } = Route.useParams();
  const album = albums.find((a) => a.id === id);
  return album ? <AlbumFound album={album} /> : <NoAlbum id={id} />;
}

function AlbumFound({ album }: { album: Group }) {
  return (
    <div className={PAGE}>
      <AlbumHeader name={album.name} description={album.description} />
      <AlbumPhotos album={album} />
    </div>
  );
}

/** The link back to every album, then the album's name and description. */
function AlbumHeader({ name, description }: { name: string; description?: string }) {
  return (
    <header className={NARROW}>
      <Link
        to="/albums"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Albums
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{name}</h1>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
    </header>
  );
}

function NoAlbum({ id }: { id: string }) {
  return (
    <div className={PAGE}>
      <AlbumHeader name="No album" />
      <p className={`${NARROW} text-muted-foreground`}>There's no album with the ID {id}.</p>
    </div>
  );
}

/** The page's column of header and photos. */
const PAGE = "flex w-full flex-col gap-8 py-16";

/** The text's column, narrower than the photos. */
const NARROW = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** Every photo in the album, each opening the viewer. */
function AlbumPhotos({ album }: { album: Group }) {
  const { shown, show, close } = useShownPhoto();
  const photos = albumPhotos(album.id);
  return (
    <>
      <p className={`${NARROW} text-sm text-muted-foreground`}>
        {photos.length} {photos.length === 1 ? "photo" : "photos"}.
      </p>
      <ul className="flex flex-col gap-6">
        {photos.map((photo) => (
          <li key={photo.id}>
            <FittedPhoto photo={photo} onOpen={() => show(photo)} />
          </li>
        ))}
      </ul>
      <PhotoLightbox photo={shown} photos={photos} onShow={show} onClose={close} />
    </>
  );
}
