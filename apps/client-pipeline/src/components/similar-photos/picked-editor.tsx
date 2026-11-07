import { useMutation } from "@tanstack/react-query";
import { PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { setPickedSimilarMutation } from "@/api/similar-photos";
import { ErrorText } from "@/components/bulk-tagging/pick-controls";
import { MoveArrows } from "@/components/move-arrows";
import type { SavedPhoto } from "@/components/saved-photo-picker";
import { PhotoChoiceGrid } from "@/components/similar-photos/photo-choice-grid";
import { foundIds, moved, photoId, pickedIds } from "@/components/similar-photos/similar-ids";
import { SimilarTile } from "@/components/similar-photos/similar-tile";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface PickedEditorProps {
  photo: SavedPhoto;
  /** Every saved photo with an ID. */
  photos: readonly SavedPhoto[];
  byId: ReadonlyMap<number, SavedPhoto>;
}

/**
 * The photos picked by hand for one photo, in the order its More like this drawer shows them
 * before the ones Find Similar Photos found, with those found ones and every other photo to pick
 * from, and Save.
 */
export function PickedEditor({ photo, photos, byId }: PickedEditorProps) {
  const [picked, setPicked] = useState(() => pickedIds(photo));
  const add = (id: number | undefined) => {
    if (id !== undefined) setPicked([...picked, id]);
  };
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Picked by hand, shown first</h3>
        <PickedRow picked={picked} byId={byId} onChange={setPicked} />
        <SavePicks photo={photo} picked={picked} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Found by Find similar photos</h3>
        <FoundRow photo={photo} picked={picked} byId={byId} onPick={add} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Pick any other photo</h3>
        <PhotoChoiceGrid
          photos={photos}
          disabled={unpickable(photo, photos, picked)}
          onChoose={(p) => add(photoId(p))}
        />
      </section>
    </div>
  );
}

/** The paths of the photos that can't be picked: the photo itself and the ones already picked. */
function unpickable(photo: SavedPhoto, photos: readonly SavedPhoto[], picked: number[]) {
  const taken = new Set([photoId(photo), ...picked]);
  return new Set(photos.filter((p) => taken.has(photoId(p))).map((p) => p.path));
}

/** Save, enabled once the picks differ from the photo's saved ones, and what came of it. */
function SavePicks({ photo, picked }: { photo: SavedPhoto; picked: number[] }) {
  const save = useMutation(setPickedSimilarMutation);
  const changed = picked.join() !== pickedIds(photo).join();
  return (
    <>
      <div className="flex items-center gap-3">
        <SaveButton
          pending={save.isPending}
          disabled={!changed}
          onClick={() => save.mutate({ path: photo.path, ids: picked })}
        />
        {save.isSuccess && !changed && (
          <span className="text-muted-foreground text-sm">Saved, waiting for Commit.</span>
        )}
      </div>
      <ErrorText error={save.error} />
    </>
  );
}

/** Save picks, with a spinner while saving. */
function SaveButton({
  pending,
  disabled,
  onClick,
}: {
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button size="sm" disabled={disabled || pending} onClick={onClick}>
      {pending ? <Spinner /> : <SaveIcon aria-hidden />}
      Save picks
    </Button>
  );
}

/** The picked photos in order, each with arrows to move it and a button to take it out. */
function PickedRow({
  picked,
  byId,
  onChange,
}: {
  picked: number[];
  byId: ReadonlyMap<number, SavedPhoto>;
  onChange: (ids: number[]) => void;
}) {
  if (picked.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        None yet: the drawer shows only the photos found below.
      </p>
    );
  }
  return (
    <ul className="flex gap-3 overflow-x-auto pb-1">
      {picked.map((id, place) => (
        <PickedTile
          key={id}
          id={id}
          photo={byId.get(id)}
          place={place}
          last={place === picked.length - 1}
          onMove={(from, to) => onChange(moved(picked, from, to))}
          onRemove={() => onChange(picked.filter((other) => other !== id))}
        />
      ))}
    </ul>
  );
}

function PickedTile({
  id,
  photo,
  place,
  last,
  onMove,
  onRemove,
}: {
  id: number;
  photo: SavedPhoto | undefined;
  place: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  if (!photo) return <li className="text-muted-foreground w-24 text-xs">Photo {id} is gone</li>;
  return (
    <SimilarTile photo={photo}>
      <MoveArrows name={photo.name} place={place} last={last} onMove={onMove} />
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Take out ${photo.name}`}
        onClick={onRemove}
      >
        <XIcon aria-hidden />
      </Button>
    </SimilarTile>
  );
}

/** The photos Find Similar Photos saved on this one, best first, each with a button to pick it. */
function FoundRow({
  photo,
  picked,
  byId,
  onPick,
}: {
  photo: SavedPhoto;
  picked: number[];
  byId: ReadonlyMap<number, SavedPhoto>;
  onPick: (id: number) => void;
}) {
  const found = foundIds(photo).flatMap((id) => {
    const other = byId.get(id);
    return other ? [{ id, other }] : [];
  });
  if (found.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        None saved yet. Run Find similar photos above.
      </p>
    );
  }
  return (
    <ul className="flex gap-3 overflow-x-auto pb-1">
      {found.map(({ id, other }) => (
        <SimilarTile key={id} photo={other}>
          <Button
            size="xs"
            variant="ghost"
            disabled={picked.includes(id)}
            onClick={() => onPick(id)}
          >
            <PlusIcon aria-hidden />
            Pick
          </Button>
        </SimilarTile>
      ))}
    </ul>
  );
}
