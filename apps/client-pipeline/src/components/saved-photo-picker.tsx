import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageOffIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { savedGroups } from "@/api/organize";
import { type InFlightFileRead, photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { photoName } from "@/components/gallery/published-file";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** A saved photo to pick: one in the photo data pull request, or one already in the portfolio. */
export interface SavedPhoto {
  path: string;
  name: string;
  /** Its Square Thumbnail, or else its smallest version, when it has one. */
  image?: string;
  /** Whether it's in the portfolio rather than only in the pull request, so Edit Photo goes back to the Gallery. */
  published: boolean;
  /** The IDs of the albums its JSON lists. */
  albums: string[];
  /** Its photo JSON file, as the filters and sorts read it. */
  file: InFlightFileRead;
}

/** The photo JSON's `images` URL for version, when it has one. */
function imageOf(file: InFlightFileRead, version: string): string | undefined {
  const images = (file.data as { images?: Record<string, unknown> } | undefined)?.images;
  const url = images?.[version];
  return typeof url === "string" ? url : undefined;
}

function savedPhoto(file: InFlightFileRead, published: boolean): SavedPhoto {
  const image = imageOf(file, "thumbnail") ?? imageOf(file, "xsmall");
  const albums = savedGroups(file.data as Record<string, unknown> | undefined).albums;
  return { path: file.path, name: photoName(file), image, published, albums, file };
}

/** The files that could be read and aren't being removed, leaving out the paths given. */
function readable(files: InFlightFileRead[] | undefined, except = new Set<string>()) {
  return (files ?? []).filter(
    (file) => !file.error && file.status !== "removed" && !except.has(file.path),
  );
}

/** The photos in the pull request, then the portfolio's that it doesn't change, each listed once. */
export function useSavedPhotos() {
  const inFlight = useQuery(photosInFlightQuery);
  const published = useQuery(publishedPhotosQuery);
  const photos = useMemo(
    () => savedPhotos(inFlight.data?.files, published.data?.files),
    [inFlight.data, published.data],
  );
  return { photos, pending: inFlight.isPending || published.isPending };
}

function savedPhotos(
  inFlight: InFlightFileRead[] | undefined,
  published: InFlightFileRead[] | undefined,
): SavedPhoto[] {
  const waiting = readable(inFlight);
  const portfolio = readable(published, new Set(waiting.map((file) => file.path)));
  return [
    ...waiting.map((file) => savedPhoto(file, false)),
    ...portfolio.map((file) => savedPhoto(file, true)),
  ];
}

/** Whether the photo's title or file name has the search text in it, ignoring case. */
export function matchesSearch(photo: SavedPhoto, search: string): boolean {
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
  const shown = photos.filter((photo) => matchesSearch(photo, search));
  if (pending) return <Spinner className="size-6" />;

  return (
    <div className="flex flex-col gap-3">
      <SavedPhotoSearch value={search} onChange={setSearch} />
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

/** A search box for saved photos, by title or file name. */
export function SavedPhotoSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (search: string) => void;
}) {
  return (
    <div className="relative">
      <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
      <Input
        type="search"
        placeholder="Search by title or file name"
        aria-label="Search saved photos"
        className="pl-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
      <SavedPhotoSquare photo={photo} />
      <span className="truncate text-xs" title={photo.name}>
        {photo.name}
      </span>
      {!photo.published && <span className="text-muted-foreground text-xs">In the batch</span>}
    </Link>
  );
}

/** The saved photo's Square Thumbnail, or an icon when it has none. */
export function SavedPhotoSquare({ photo }: { photo: SavedPhoto }) {
  return (
    <span className="bg-muted flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border">
      {photo.image ? (
        <img src={photo.image} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOffIcon className="text-muted-foreground size-5" aria-hidden />
      )}
    </span>
  );
}
