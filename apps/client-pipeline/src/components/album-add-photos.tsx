import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { type Group, addPhotoGroupsMutation, groupLabel } from "@/api/organize";
import { photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import {
  type SavedPhoto,
  SavedPhotoSearch,
  SavedPhotoSquare,
  matchesSearch,
  useSavedPhotos,
} from "@/components/saved-photo-picker";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Adds saved photos to an album, then reads the saved photos again and follows CI's rebuild. */
export function useAlbumAdd() {
  const queryClient = useQueryClient();
  const rebuild = useAllPhotosRebuild(true, () => {});
  const add = useMutation({
    ...addPhotoGroupsMutation,
    onSuccess: () => {
      rebuild.afterPush();
      void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
    },
  });
  return { add, rebuild };
}

/** Adding photos to an album from its page, and how it went. */
export type AlbumAdd = ReturnType<typeof useAlbumAdd>;

interface AlbumAddPhotosProps {
  album: Group;
  add: AlbumAdd["add"];
}

/**
 * The album page's "Add photos" button: a modal of the saved photos not in the album yet, to pick
 * any number of and add to it as one change waiting for Commit. Each photo keeps its other albums.
 */
export function AlbumAddPhotos({ album, add }: AlbumAddPhotosProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const change = (next: boolean) => {
    setOpen(next);
    setPicked(new Set());
  };
  const save = () =>
    add.mutate(
      { paths: [...picked], albums: [album.id], tags: [], genres: [] },
      { onSuccess: () => change(false) },
    );

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={() => add.reset()}>
          <PlusIcon aria-hidden />
          Add photos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add photos to {groupLabel(album)}</DialogTitle>
          <DialogDescription>
            Pick saved photos that aren't in this album yet. Each keeps the albums it's already in,
            and the change waits for Commit.
          </DialogDescription>
        </DialogHeader>
        <PhotoChoices
          albumId={album.id}
          picked={picked}
          disabled={add.isPending}
          onChange={setPicked}
        />
        {add.isError && <p className="text-destructive text-sm">{add.error.message}</p>}
        <DialogFooter>
          <Button disabled={picked.size === 0 || add.isPending} onClick={save}>
            {add.isPending && <Spinner />}
            {addText(picked.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function addText(count: number): string {
  if (count === 0) return "Pick photos";
  return `Add ${photoCount(count)}`;
}

function photoCount(n: number): string {
  return n === 1 ? "1 photo" : `${n} photos`;
}

interface PhotoChoicesProps {
  albumId: string;
  picked: ReadonlySet<string>;
  disabled: boolean;
  onChange: (picked: ReadonlySet<string>) => void;
}

/** The saved photos not in the album, with a search, each a tile to pick or unpick. */
function PhotoChoices({ albumId, picked, disabled, onChange }: PhotoChoicesProps) {
  const { photos, pending } = useSavedPhotos();
  const [search, setSearch] = useState("");
  if (pending) return <Spinner className="size-6" />;
  const outside = photos.filter((photo) => !photo.albums.includes(albumId));
  const shown = outside.filter((photo) => matchesSearch(photo, search));
  const toggle = (path: string) => {
    const next = new Set(picked);
    if (!next.delete(path)) next.add(path);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <SavedPhotoSearch value={search} onChange={setSearch} />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {photoCount(picked.size)} picked, of {outside.length} not in this album
      </p>
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No saved photos match.</p>
      ) : (
        <ul className="grid max-h-[50dvh] grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
          {shown.map((photo) => (
            <li key={photo.path}>
              <ChoiceTile
                photo={photo}
                picked={picked.has(photo.path)}
                disabled={disabled}
                onToggle={toggle}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ChoiceTileProps {
  photo: SavedPhoto;
  picked: boolean;
  disabled: boolean;
  onToggle: (path: string) => void;
}

function ChoiceTile({ photo, picked, disabled, onToggle }: ChoiceTileProps) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={disabled}
      onClick={() => onToggle(photo.path)}
      className={cn(
        "hover:bg-muted/60 focus-visible:ring-ring/50 relative flex w-full flex-col gap-1 rounded-md p-1 text-left outline-none focus-visible:ring-[3px] disabled:opacity-60",
        picked && "ring-primary ring-2",
      )}
    >
      <SavedPhotoSquare photo={photo} />
      <span className="truncate text-xs" title={photo.name}>
        {photo.name}
      </span>
      <span className="text-muted-foreground text-xs">{otherAlbumsText(photo)}</span>
      {picked && (
        <span className="bg-primary text-primary-foreground absolute top-2 left-2 flex size-5 items-center justify-center rounded">
          <CheckIcon className="size-3.5" aria-hidden />
        </span>
      )}
    </button>
  );
}

/** Whether the photo is in the batch only, and how many other albums it's in. */
function otherAlbumsText(photo: SavedPhoto): string {
  const where = photo.published ? "" : "In the batch · ";
  const n = photo.albums.length;
  return `${where}${n === 0 ? "No albums" : `${n} ${n === 1 ? "album" : "albums"}`}`;
}

/** What adding photos to the album did, under its photos. */
export function AlbumAddOutcome({ add, rebuild }: AlbumAdd) {
  if (!add.isSuccess) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          Added {photoCount(add.data.files)} to the album in the app.{" "}
          <WaitingForCommit pullRequestUrl={add.data.pullRequestUrl} what="The changes" />
        </span>
      </p>
      <AllPhotosRebuild status={rebuild.status} />
    </div>
  );
}
