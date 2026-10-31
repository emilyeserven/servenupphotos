import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { type Group, deleteAlbumMutation, groupLabel, organizeQuery } from "@/api/organize";
import { photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/** Deletes an album, then reads the albums and saved photos again and goes back to the Albums list. */
function useAlbumDelete() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    ...deleteAlbumMutation,
    onSuccess: async () => {
      // Leave first, so the page doesn't say the album isn't there.
      await navigate({ to: "/albums" });
      for (const query of [organizeQuery, publishedPhotosQuery, photosInFlightQuery]) {
        void queryClient.invalidateQueries({ queryKey: query.queryKey });
      }
    },
  });
}

interface AlbumDeleteCardProps {
  album: Group;
  albums: Group[];
  /** How many photos in ALLPHOTOS.json list the album itself; undefined until it's read. */
  photoCount?: number;
}

/**
 * The album page's Delete album card: a button that asks first, saying what goes with it, then
 * deletes the album's file, takes it out of its photos and moves its sub-albums up, as changes
 * waiting for Commit.
 */
export function AlbumDeleteCard({ album, albums, photoCount }: AlbumDeleteCardProps) {
  const [open, setOpen] = useState(false);
  const remove = useAlbumDelete();
  const change = (next: boolean) => {
    setOpen(next);
    remove.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete album</CardTitle>
        <CardDescription>
          Deletes this album as a change waiting for Commit. Its photos stay, in their other albums.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={change}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2Icon aria-hidden />
              Delete album
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {groupLabel(album)}?</DialogTitle>
              <DialogDescription>
                It waits for Commit like any other change, so GitHub doesn&apos;t change until then.
              </DialogDescription>
            </DialogHeader>
            <DeleteConsequences album={album} albums={albums} photoCount={photoCount} />
            {remove.isError && <p className="text-destructive text-sm">{remove.error.message}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={remove.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(album.id)}
              >
                {remove.isPending && <Spinner />}
                Delete album
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/** What deleting the album does to its photos, its sub-albums and the portfolio's spotlight spots. */
function DeleteConsequences({ album, albums, photoCount }: AlbumDeleteCardProps) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
      <li>{photosText(photoCount)}</li>
      <SubAlbumsLine album={album} albums={albums} />
      <SpotlightLine zones={album.spotlightZones ?? []} />
      <li>Its photo order, covers and layout are deleted with it.</li>
    </ul>
  );
}

/** Where the albums directly inside the album go; nothing when it has none. */
function SubAlbumsLine({ album, albums }: Omit<AlbumDeleteCardProps, "photoCount">) {
  const children = albums.filter((a) => a.parent === album.id && a.id !== album.id);
  if (children.length === 0) return null;
  const parent = albums.find((a) => a.id === album.parent);
  return (
    <li>
      {movesText(children.length)} up to {parent ? groupLabel(parent) : "the top level"}.
    </li>
  );
}

function movesText(n: number): string {
  return n === 1 ? "1 album inside it moves" : `${n} albums inside it move`;
}

/** The portfolio's spotlight spots left without an album; nothing when it shows in none. */
function SpotlightLine({ zones }: { zones: string[] }) {
  if (zones.length === 0) return null;
  return (
    <li>
      The portfolio&apos;s {zones.join(", ")} spotlight {zones.length === 1 ? "spot" : "spots"} will
      show no album until you pick another.
    </li>
  );
}

function photosText(count?: number): string {
  if (count === undefined) return "Every photo that lists it is taken out of it.";
  if (count === 0) return "No photos list it.";
  const photos = count === 1 ? "1 photo is" : `${count} photos are`;
  return `${photos} taken out of it, keeping their other albums.`;
}
