import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageOffIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { type InFlightFileRead, photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { photoName } from "@/components/gallery/published-file";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** A saved photo to pick: one in the photo data pull request, or one already in the portfolio. */
interface SavedPhoto {
  path: string;
  name: string;
  /** Its Square Thumbnail, or else its smallest version, when it has one. */
  image?: string;
  /** Whether it's in the portfolio rather than only in the pull request, so Edit Photo goes back to the Gallery. */
  published: boolean;
}

/** The photo JSON's `images` URL for version, when it has one. */
function imageOf(file: InFlightFileRead, version: string): string | undefined {
  const images = (file.data as { images?: Record<string, unknown> } | undefined)?.images;
  const url = images?.[version];
  return typeof url === "string" ? url : undefined;
}

function savedPhoto(file: InFlightFileRead, published: boolean): SavedPhoto {
  const image = imageOf(file, "thumbnail") ?? imageOf(file, "xsmall");
  return { path: file.path, name: photoName(file), image, published };
}

/** The files that could be read, leaving out the paths given. */
function readable(files: InFlightFileRead[] | undefined, except = new Set<string>()) {
  return (files ?? []).filter((file) => !file.error && !except.has(file.path));
}

/** The photos in the pull request, then the portfolio's that it doesn't change, each listed once. */
function useSavedPhotos() {
  const inFlight = useQuery(photosInFlightQuery);
  const published = useQuery(publishedPhotosQuery);
  const waiting = readable(inFlight.data?.files);
  const portfolio = readable(published.data?.files, new Set(waiting.map((file) => file.path)));
  const photos = [
    ...waiting.map((file) => savedPhoto(file, false)),
    ...portfolio.map((file) => savedPhoto(file, true)),
  ];
  return { photos, pending: inFlight.isPending || published.isPending };
}

function matches(photo: SavedPhoto, search: string): boolean {
  const text = `${photo.name} ${photo.path}`.toLowerCase();
  return text.includes(search.trim().toLowerCase());
}

/**
 * The photos already saved, in the photo data pull request or the portfolio, to pick one to open
 * on Edit Photo, with a search by title or file name.
 */
export function SavedPhotoPicker({ onPicked }: { onPicked?: () => void }) {
  const { photos, pending } = useSavedPhotos();
  const [search, setSearch] = useState("");
  const shown = photos.filter((photo) => matches(photo, search));
  if (pending) return <Spinner className="size-6" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          type="search"
          placeholder="Search by title or file name"
          aria-label="Search saved photos"
          className="pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No saved photos match.</p>
      ) : (
        <ul className="grid max-h-[50dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {shown.map((photo) => (
            <li key={photo.path}>
              <SavedPhotoTile photo={photo} onPicked={onPicked} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedPhotoTile({ photo, onPicked }: { photo: SavedPhoto; onPicked?: () => void }) {
  return (
    <Link
      to="/exif"
      search={photo.published ? { edit: photo.path, from: "gallery" } : { edit: photo.path }}
      onClick={onPicked}
      className="hover:bg-muted/60 focus-visible:ring-ring/50 flex flex-col gap-1 rounded-md p-1 outline-none focus-visible:ring-[3px]"
    >
      <span className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-md border">
        {photo.image ? (
          <img src={photo.image} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageOffIcon className="text-muted-foreground size-5" aria-hidden />
        )}
      </span>
      <span className="truncate text-xs" title={photo.name}>
        {photo.name}
      </span>
      {!photo.published && <span className="text-muted-foreground text-xs">In the batch</span>}
    </Link>
  );
}
