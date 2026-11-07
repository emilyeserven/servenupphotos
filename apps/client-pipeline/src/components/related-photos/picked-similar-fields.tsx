import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SavedPhoto } from "@/components/saved-photo-picker";
import { PhotoChoiceGrid } from "@/components/related-photos/photo-choice-grid";
import { MAX_PICKS, type Pick, savedPhotoId } from "@/components/related-photos/picks";
import { PickedRow } from "@/components/related-photos/picked-row";
import { SimilarTile } from "@/components/related-photos/similar-tile";
import { Button } from "@/components/ui/button";

interface PickedSimilarFieldsProps {
  /** The ID of the photo the picks are for, which can't be picked itself. */
  self: number | undefined;
  /** The IDs Find Related Photos saved on it, best first. */
  found: number[];
  /** The photos picked so far, in order, with their notes. */
  picks: Pick[];
  onChange: (picks: Pick[]) => void;
  /** Every saved photo with an ID. */
  photos: readonly SavedPhoto[];
  byId: ReadonlyMap<number, SavedPhoto>;
  /** Shown under the picks, such as a Save button. */
  children?: ReactNode;
}

/**
 * The photos picked by hand for one photo, up to MAX_PICKS, each with a note, in the order its
 * More like this drawer shows them before the ones Find Related Photos found, with those found ones and every
 * other photo to pick from. The Related Photos page and the Photo page both use it.
 */
export function PickedSimilarFields({
  self,
  found,
  picks,
  onChange,
  photos,
  byId,
  children,
}: PickedSimilarFieldsProps) {
  const picked = picks.map((pick) => pick.id);
  const add = (id: number | undefined) => {
    if (id !== undefined) onChange([...picks, { id, note: "" }]);
  };
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Picked by hand, shown first ({picked.length} of {MAX_PICKS})
        </h3>
        <PickedRow picks={picks} byId={byId} onChange={onChange} />
        {children}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Found by Find related photos</h3>
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

/** The photos Find Related Photos saved on this one, best first, each with a button to pick it. */
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
        None saved yet. Run Find related photos on the Related Photos page.
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
