import { PlusIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MoveArrows } from "@/components/move-arrows";
import type { SavedPhoto } from "@/components/saved-photo-picker";
import { PhotoChoiceGrid } from "@/components/similar-photos/photo-choice-grid";
import { MAX_PICKS, savedPhotoId } from "@/components/similar-photos/similar-ids";
import { moved } from "@/lib/album-photo-order";
import { SimilarTile } from "@/components/similar-photos/similar-tile";
import { Button } from "@/components/ui/button";

interface PickedSimilarFieldsProps {
  /** The ID of the photo the picks are for, which can't be picked itself. */
  self: number | undefined;
  /** The IDs Find Similar Photos saved on it, best first. */
  found: number[];
  /** The IDs picked so far, in order. */
  picked: number[];
  onChange: (ids: number[]) => void;
  /** Every saved photo with an ID. */
  photos: readonly SavedPhoto[];
  byId: ReadonlyMap<number, SavedPhoto>;
  /** Shown under the picks, such as a Save button. */
  children?: ReactNode;
}

/**
 * The photos picked by hand for one photo, up to MAX_PICKS, in the order its More like this
 * drawer shows them before the ones Find Similar Photos found, with those found ones and every
 * other photo to pick from. The Similar Photos page and the Photo page both use it.
 */
export function PickedSimilarFields({
  self,
  found,
  picked,
  onChange,
  photos,
  byId,
  children,
}: PickedSimilarFieldsProps) {
  const add = (id: number | undefined) => {
    if (id !== undefined) onChange([...picked, id]);
  };
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Picked by hand, shown first ({picked.length} of {MAX_PICKS})
        </h3>
        <PickedRow picked={picked} byId={byId} onChange={onChange} />
        {children}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Found by Find similar photos</h3>
        <FoundRow found={found} picked={picked} byId={byId} onPick={add} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Pick any other photo</h3>
        <OtherPhotos self={self} picked={picked} photos={photos} onPick={add} />
      </section>
    </div>
  );
}

/** Every photo to pick from, leaving out the photo itself and the ones picked, until MAX_PICKS are. */
function OtherPhotos({
  self,
  picked,
  photos,
  onPick,
}: {
  self: number | undefined;
  picked: number[];
  photos: readonly SavedPhoto[];
  onPick: (id: number | undefined) => void;
}) {
  if (picked.length >= MAX_PICKS) {
    return (
      <p className="text-muted-foreground text-sm">
        {MAX_PICKS} photos are picked, as many as the drawer shows. Take one out to pick another.
      </p>
    );
  }
  const taken = new Set([self, ...picked]);
  const disabled = new Set(photos.filter((p) => taken.has(savedPhotoId(p))).map((p) => p.path));
  return (
    <PhotoChoiceGrid
      photos={photos}
      disabled={disabled}
      onChoose={(p) => onPick(savedPhotoId(p))}
    />
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
  found: ids,
  picked,
  byId,
  onPick,
}: {
  found: number[];
  picked: number[];
  byId: ReadonlyMap<number, SavedPhoto>;
  onPick: (id: number) => void;
}) {
  const full = picked.length >= MAX_PICKS;
  const found = ids.flatMap((id) => {
    const other = byId.get(id);
    return other ? [{ id, other }] : [];
  });
  if (found.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        None saved yet. Run Find similar photos on the Similar Photos page.
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
            disabled={full || picked.includes(id)}
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
