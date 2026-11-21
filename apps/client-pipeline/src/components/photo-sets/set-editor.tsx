import { useMemo, useState } from "react";
import { savePhotoSetMutation } from "@/api/photo-sets";
import type { SocialPhoto } from "@/api/publish";
import { ErrorNote } from "@/components/error-note";
import { PhotoDrawerToggle } from "@/components/instagram-picker/photo-drawer";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import { SET_PHOTO_DRAG_TYPE, SetPhotos } from "@/components/photo-sets/set-photos";
import { SaveState } from "@/components/save-state";
import { Input } from "@/components/ui/input";
import { useDelayedDraft } from "@/hooks/use-delayed-draft";
import { addToSet, moveSetPhoto, photoIdOf, removeSetPhoto, setsByPhoto } from "@/lib/photo-sets";
import type { PhotoSet } from "@portfolio/lib/photo-sets";

/** What the photo drawer says beside the set. */
const SET_DRAWER_WORDS = {
  help: "Drag a photo onto the set, or click it to add it at the end. A photo already in another set has to come out of that one first.",
  showUsed: "Show photos already in a set",
  usedBadge: "In a set",
};

interface SetEditorProps {
  /** The set as the next Commit has it. */
  saved: PhotoSet;
  /** Every set, to tell which photos are in another one. */
  sets: PhotoSet[];
  photos: SocialPhoto[];
}

/**
 * The open set: its name and photos in order, with the photo drawer beside them. Each change is
 * saved as a change waiting for Commit shortly after the last one.
 */
export function SetEditor({ saved, sets, photos }: SetEditorProps) {
  const { value: set, update, error, saving } = useDelayedDraft(saved, savePhotoSetMutation);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [note, setNote] = useState("");
  const byId = useMemo(() => photosById(photos), [photos]);
  const owners = useMemo(
    () => setsByPhoto([set, ...sets.filter((other) => other.id !== set.id)]),
    [set, sets],
  );
  const used = useMemo(() => usedPaths(photos, owners), [photos, owners]);
  const add = (photo: SocialPhoto | undefined) => {
    const added = addToSet(set, photo, owners);
    setNote(added.note);
    if (added.set !== set) update(added.set);
  };
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <Input
              value={set.name}
              onChange={(event) => update({ ...set, name: event.target.value })}
              className="w-64"
            />
          </label>
          <div className="flex items-center gap-2">
            <SaveState saving={saving} error={error} />
            <PhotoDrawerToggle open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
          </div>
        </div>
        <ErrorNote error={note} />
        <SetPhotos
          ids={set.photos}
          byId={byId}
          onAdd={(path) => add(photos.find((photo) => photo.path === path))}
          onMove={(from, to) => update(moveSetPhoto(set, from, to))}
          onRemove={(id) => update(removeSetPhoto(set, id))}
        />
      </div>
      {drawerOpen && (
        <PhotoDrawerPanel
          photos={photos}
          used={used}
          onPick={add}
          onClose={() => setDrawerOpen(false)}
          dragType={SET_PHOTO_DRAG_TYPE}
          words={SET_DRAWER_WORDS}
        />
      )}
    </div>
  );
}

/** The photo files by their photo ID; files without one yet are left out. */
function photosById(photos: SocialPhoto[]): Map<number, SocialPhoto> {
  return new Map(
    photos.flatMap((photo) => {
      const id = photoIdOf(photo);
      return id === undefined ? [] : [[id, photo] as const];
    }),
  );
}

/** The paths of the photo files that are in a set. */
function usedPaths(photos: SocialPhoto[], owners: Map<number, PhotoSet>): Set<string> {
  return new Set(
    photos.filter((photo) => owners.has(photoIdOf(photo) ?? -1)).map((photo) => photo.path),
  );
}
