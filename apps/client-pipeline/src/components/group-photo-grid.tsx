import { Link } from "@tanstack/react-router";
import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import type { GroupKind } from "@/api/organize";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  type CombinedPhoto,
  currentPhotos,
  photoImage,
  photoIn,
  photoText,
} from "@/lib/group-photos";
import { albumPhotoOrder } from "@/lib/album-photo-order";
import { squareImages } from "@/lib/offline-thumbnails";
import { useCombinedData } from "@/stores/combined-data";

/** ALLPHOTOS.json from the combined data store, and its photos listing any of ids under kind. */
export function useGroupPhotos(kind: GroupKind, ids: ReadonlySet<string>) {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  const photos = current ? current.photos.filter((photo) => photoIn(photo, kind, ids)) : undefined;
  return { combined, current, photos };
}

/** ALLPHOTOS.json as the combined data store has it, and its photos in an album or tag. */
export type GroupPhotos = ReturnType<typeof useGroupPhotos>;

/**
 * The photos as Square Thumbnails, in the album's order (its photo order, when it has one, then
 * the default order), each opening full size, or why there are none:
 * ALLPHOTOS.json still being read or unreadable, or no photo listing it.
 */
export function GroupPhotoGrid({
  combined,
  photos,
  order,
}: Pick<GroupPhotos, "combined" | "photos"> & { order?: number[] }) {
  if (combined.isPending) return <p>Reading ALLPHOTOS.json…</p>;
  if (!photos) return <ReadError error={combined.error} />;
  if (photos.length === 0) return <NoPhotos />;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
      {albumPhotoOrder(photos, order).map((photo, i) => (
        <li key={`${photoText(photo, "file") ?? ""}-${i}`}>
          <PhotoTile photo={photo} />
        </li>
      ))}
    </ul>
  );
}

function ReadError({ error }: { error?: Error }) {
  return (
    <p className="text-destructive">{error ? error.message : "ALLPHOTOS.json couldn't be read."}</p>
  );
}

function NoPhotos() {
  return (
    <p className="text-muted-foreground">
      No photos yet. Add them on the{" "}
      <Link to="/gallery" className="text-foreground underline underline-offset-4">
        Gallery
      </Link>{" "}
      or a photo's page.
    </p>
  );
}

/** What to call a photo: its title, or else its original file name. */
export function photoName(photo: CombinedPhoto): string {
  return photoText(photo, "title") ?? photoText(photo, "file") ?? "Untitled";
}

/**
 * The photo's Square Thumbnail from the offline copy, so it still shows without the internet, or
 * else its smallest version.
 */
export function squareUrl(photo: CombinedPhoto): string | undefined {
  return squareImages(photo)?.square ?? photoImage(photo, "small");
}

/** The photo at the largest size worth opening in a lightbox. */
function fullUrl(photo: CombinedPhoto): string | undefined {
  return photoImage(photo, "xlarge") ?? photoImage(photo, "full");
}

/** A photo's Square Thumbnail and title, opening the photo full size. */
function PhotoTile({ photo }: { photo: CombinedPhoto }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = photoName(photo);
  const square = squareUrl(photo);
  const full = fullUrl(photo);
  return (
    <figure className="flex flex-col gap-1.5">
      {square && !failed ? (
        <button
          type="button"
          title="Show it full size"
          disabled={!full}
          onClick={() => setOpen(true)}
          className="focus-visible:ring-ring bg-muted aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border outline-none focus-visible:ring-2"
        >
          <img
            src={square}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        </button>
      ) : (
        <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border text-xs">
          <ImageOffIcon className="size-5" aria-hidden />
          No image
        </div>
      )}
      <figcaption className="truncate text-xs" title={name}>
        {name}
      </figcaption>
      {full && (
        <ImageLightbox
          open={open}
          onClose={() => setOpen(false)}
          title={name}
          src={full}
          description={`${name} at full size.`}
        />
      )}
    </figure>
  );
}
