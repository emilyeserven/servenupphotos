import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { type Group, organizeQuery, removeAlbumPhotosMutation } from "@/api/organize";
import { photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { AllPhotosRebuild } from "@/components/all-photos-rebuild";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { albumPhotoOrder, photoId } from "@/lib/album-photo-order";
import { type CombinedPhoto, photoIn } from "@/lib/group-photos";
import { cn } from "@/lib/utils";

/** Takes photos out of an album, then reads the albums and the saved photos again. */
export function useAlbumRemove() {
  const queryClient = useQueryClient();
  return useMutation({
    ...removeAlbumPhotosMutation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
    },
  });
}

/** Taking photos out of an album from its page, and how it went. */
export type AlbumRemove = ReturnType<typeof useAlbumRemove>;

interface AlbumRemovePhotosProps {
  album: Group;
  /** The photos shown on the album's page, maybe with its sub-albums' too. */
  photos: CombinedPhoto[];
  remove: AlbumRemove;
  /** Called once the photos are removed, or when it's left without removing any. */
  onDone: () => void;
}

/**
 * The album's own photos as tiles to pick, and a button that takes the picked ones out of it, its
 * photo order, covers and layout, as one change waiting for Commit. Photos only in a sub-album
 * aren't listed, since they're removed from that album's page.
 */
export function AlbumRemovePhotos({ album, photos, remove, onDone }: AlbumRemovePhotosProps) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const own = albumPhotoOrder(
    photos.filter((photo) => photoIn(photo, "albums", new Set([album.id]))),
    album.photoOrder,
  );
  const toggle = (id: number) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };
  const save = () => remove.mutate({ id: album.id, photoIds: [...picked] }, { onSuccess: onDone });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Pick the photos to take out of this album. Each keeps its other albums, and is taken out of
        this album&apos;s photo order, covers and layout too.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
        {own.map((photo, i) => (
          <li key={photoId(photo) ?? `index-${i}`}>
            <RemoveTile
              photo={photo}
              picked={picked.has(photoId(photo) ?? 0)}
              disabled={remove.isPending}
              onToggle={toggle}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={picked.size === 0 || remove.isPending}
          onClick={save}
        >
          {remove.isPending && <Spinner />}
          {removeText(picked.size)}
        </Button>
        <Button variant="outline" disabled={remove.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {remove.isError && <p className="text-destructive">{remove.error.message}</p>}
    </div>
  );
}

function removeText(count: number): string {
  if (count === 0) return "Pick photos";
  return `Remove ${photoCount(count)}`;
}

function photoCount(n: number): string {
  return n === 1 ? "1 photo" : `${n} photos`;
}

interface RemoveTileProps {
  photo: CombinedPhoto;
  picked: boolean;
  disabled: boolean;
  onToggle: (id: number) => void;
}

/** A photo's Square Thumbnail and name, to pick for removing; one without an ID can't be. */
function RemoveTile({ photo, picked, disabled, onToggle }: RemoveTileProps) {
  const id = photoId(photo);
  const name = photoName(photo);
  const square = squareUrl(photo);
  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={disabled || id === undefined}
      onClick={() => onToggle(id ?? 0)}
      className={cn(
        "hover:bg-muted/60 focus-visible:ring-ring/50 relative flex w-full flex-col gap-1.5 rounded-lg p-1 text-left outline-none focus-visible:ring-[3px] disabled:opacity-60",
        picked && "ring-destructive ring-2",
      )}
    >
      <RemoveThumbnail square={square} name={name} />
      <span className="truncate text-xs" title={name}>
        {name}
      </span>
      {picked && (
        <span className="bg-destructive absolute top-2 left-2 flex size-5 items-center justify-center rounded text-white">
          <CheckIcon className="size-3.5" aria-hidden />
        </span>
      )}
    </button>
  );
}

/** The photo's Square Thumbnail, or a placeholder when it has none. */
function RemoveThumbnail({ square, name }: { square?: string; name: string }) {
  return (
    <div className="bg-muted flex aspect-square w-full items-center justify-center overflow-hidden rounded-md">
      {square ? (
        <img src={square} alt={name} loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOffIcon className="text-muted-foreground size-5" aria-hidden />
      )}
    </div>
  );
}

/** What taking photos out of the album did, under its photos. */
export function AlbumRemoveOutcome({ remove }: { remove: AlbumRemove }) {
  if (!remove.isSuccess) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          Removed {photoCount(remove.data.photos)} from the album in the app.{" "}
          <WaitingForCommit pullRequestUrl={remove.data.pullRequestUrl} what="The changes" />
        </span>
      </p>
      <AllPhotosRebuild />
    </div>
  );
}
