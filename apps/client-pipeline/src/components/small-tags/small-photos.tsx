import { ImageOffIcon } from "lucide-react";
import type { TagLibraryPhotoInfo } from "@/api/tag-library";
import { PhotoTile, squareUrl } from "@/components/group-photo-grid";
import { type CombinedPhoto, currentListedPhotos } from "@/lib/group-photos";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** The photos ALLPHOTOS.json lists, by photo ID, for their Square Thumbnails. */
export type PhotosById = ReadonlyMap<number, CombinedPhoto>;

/** ALLPHOTOS.json's photos from the combined data store, by photo ID; empty while it's read. */
export function usePhotosById(): PhotosById {
  const combined = useCombinedData();
  const photos = combined.data ? (currentListedPhotos(combined.data)?.photos ?? []) : [];
  return new Map(
    photos.flatMap((photo) => (typeof photo.id === "number" ? [[photo.id, photo] as const] : [])),
  );
}

/** photo's entry in ALLPHOTOS.json, when it has an ID that's listed there. */
function combinedOf(photo: TagLibraryPhotoInfo, byId: PhotosById): CombinedPhoto | undefined {
  return photo.id === null ? undefined : byId.get(photo.id);
}

/** A photo's title, or else its file name. */
function libraryPhotoName(photo: TagLibraryPhotoInfo): string {
  return photo.title || photo.photo;
}

/** A photo not in ALLPHOTOS.json yet, such as one waiting for Commit: its name, without an image. */
function NoImage({ photo }: { photo: TagLibraryPhotoInfo }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border text-xs">
        <ImageOffIcon className="size-5" aria-hidden />
        No image
      </div>
      <figcaption className="truncate text-xs" title={libraryPhotoName(photo)}>
        {libraryPhotoName(photo)}
      </figcaption>
    </figure>
  );
}

/** The photos that have a tag, as Square Thumbnails opening full size. */
export function TaggedPhotos({
  photos,
  byId,
}: {
  photos: TagLibraryPhotoInfo[];
  byId: PhotosById;
}) {
  if (photos.length === 0) {
    return <p className="text-muted-foreground text-sm">No photo has it itself.</p>;
  }
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
      {photos.map((photo) => {
        const combined = combinedOf(photo, byId);
        return (
          <li key={photo.path}>
            {combined ? <PhotoTile photo={combined} /> : <NoImage photo={photo} />}
          </li>
        );
      })}
    </ul>
  );
}

interface PickablePhotoProps {
  photo: TagLibraryPhotoInfo;
  byId: PhotosById;
  picked: boolean;
  onToggle: () => void;
}

/** A photo to tick for adding a tag to: its Square Thumbnail and name, ringed once ticked. */
export function PickablePhoto({ photo, byId, picked, onToggle }: PickablePhotoProps) {
  const combined = combinedOf(photo, byId);
  const url = combined && squareUrl(combined);
  return (
    <label className="flex cursor-pointer flex-col gap-1.5">
      <span
        className={cn(
          "bg-muted relative aspect-square w-full overflow-hidden rounded-lg border",
          picked && "ring-primary ring-2",
        )}
      >
        {url ? (
          <img src={url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageOffIcon
            className="text-muted-foreground absolute inset-0 m-auto size-5"
            aria-hidden
          />
        )}
        <input
          type="checkbox"
          checked={picked}
          onChange={onToggle}
          className="absolute top-2 left-2 size-4"
        />
      </span>
      <span className="truncate text-xs" title={libraryPhotoName(photo)}>
        {libraryPhotoName(photo)}
      </span>
    </label>
  );
}
