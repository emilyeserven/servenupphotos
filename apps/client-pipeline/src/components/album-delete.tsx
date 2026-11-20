import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type Group, deleteAlbumMutation, groupLabel, organizeQuery } from "@/api/organize";
import { photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { ConfirmDeleteCard } from "@/components/confirm-delete-card";
import { count } from "@portfolio/lib/words";

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
  const remove = useAlbumDelete();
  return (
    <ConfirmDeleteCard
      action="Delete album"
      description="Deletes this album as a change waiting for Commit. Its photos stay, in their other albums."
      question={`Delete ${groupLabel(album)}?`}
      note="It waits for Commit like any other change, so GitHub doesn't change until then."
      remove={{ ...remove, run: () => remove.mutate(album.id) }}
    >
      <DeleteConsequences album={album} albums={albums} photoCount={photoCount} />
    </ConfirmDeleteCard>
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
  return count(n, "album inside it moves", "albums inside it move");
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

function photosText(n?: number): string {
  if (n === undefined) return "Every photo that lists it is taken out of it.";
  if (n === 0) return "No photos list it.";
  const photos = count(n, "photo is", "photos are");
  return `${photos} taken out of it, keeping their other albums.`;
}
