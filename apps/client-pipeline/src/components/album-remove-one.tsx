import { XIcon } from "lucide-react";
import type { Group } from "@/api/organize";
import type { AlbumRemove } from "@/components/album-remove-photos";
import { type GroupPhotos, GroupPhotoGrid, photoName } from "@/components/group-photo-grid";
import { Spinner } from "@/components/ui/spinner";
import { photoId } from "@/lib/album-photo-order";
import { type CombinedPhoto, photoIn } from "@/lib/group-photos";

interface AlbumPhotoGridProps extends Pick<GroupPhotos, "combined" | "photos"> {
  album: Group;
  remove: AlbumRemove;
  /** Whether each of the album's own photos gets a button that takes it out of the album. */
  removable: boolean;
}

/**
 * The album's photos in its order, each of its own with a button that takes it out of the album
 * when the album's photos are chosen by hand.
 */
export function AlbumPhotoGrid({
  album,
  combined,
  photos,
  remove,
  removable,
}: AlbumPhotoGridProps) {
  const action = removable
    ? (photo: CombinedPhoto) => <AlbumRemoveOne album={album} photo={photo} remove={remove} />
    : undefined;
  return (
    <GroupPhotoGrid combined={combined} photos={photos} order={album.photoOrder} action={action} />
  );
}

interface AlbumRemoveOneProps {
  album: Group;
  photo: CombinedPhoto;
  remove: AlbumRemove;
}

/**
 * A button on a photo's tile on the album's page that takes that one photo out of the album, and
 * out of its photo order, covers and layout, as a change waiting for Commit. A photo only in a
 * sub-album, or without an ID, gets none.
 */
function AlbumRemoveOne({ album, photo, remove }: AlbumRemoveOneProps) {
  const id = photoId(photo);
  if (id === undefined || !photoIn(photo, "albums", new Set([album.id]))) return null;
  const name = photoName(photo);
  return (
    <button
      type="button"
      title="Remove from this album"
      aria-label={`Remove ${name} from this album`}
      disabled={remove.isPending}
      onClick={() => remove.mutate({ id: album.id, photoIds: [id] })}
      className="bg-background/90 text-foreground hover:bg-destructive focus-visible:ring-ring absolute top-1.5 right-1.5 z-10 flex size-7 items-center justify-center rounded-full border shadow-sm outline-none hover:text-white focus-visible:opacity-100 focus-visible:ring-2 disabled:opacity-60 sm:opacity-0 sm:group-hover/tile:opacity-100"
    >
      {removingThis(remove, id) ? <Spinner /> : <XIcon className="size-4" aria-hidden />}
    </button>
  );
}

/** Whether this photo is the one being taken out of the album right now. */
function removingThis(remove: AlbumRemove, id: number): boolean {
  return remove.isPending && remove.variables.photoIds.includes(id);
}
