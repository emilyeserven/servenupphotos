import { XIcon } from "lucide-react";
import { MoveArrows } from "@/components/move-arrows";
import { type SavedPhoto, SavedPhotoSquare } from "@/components/saved-photo-picker";
import { MAX_PICK_NOTE, type Pick } from "@/components/related-photos/picks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { moved } from "@/lib/album-photo-order";

interface PickedRowProps {
  picks: Pick[];
  byId: ReadonlyMap<number, SavedPhoto>;
  onChange: (picks: Pick[]) => void;
}

/**
 * The picked photos in order, one per line: each one's thumbnail, with its title and the note the
 * drawer shows to the right of it, arrows to move it and a button to take it out.
 */
export function PickedRow({ picks, byId, onChange }: PickedRowProps) {
  if (picks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        None yet: the drawer shows only the photos found below.
      </p>
    );
  }
  const replace = (place: number, pick: Pick) =>
    onChange(picks.map((other, i) => (i === place ? pick : other)));
  return (
    <ul className="flex flex-col gap-3">
      {picks.map((pick, place) => (
        <PickedLine
          key={pick.id}
          pick={pick}
          photo={byId.get(pick.id)}
          place={place}
          last={place === picks.length - 1}
          onNote={(note) => replace(place, { ...pick, note })}
          onMove={(from, to) => onChange(moved(picks, from, to))}
          onRemove={() => onChange(picks.filter((other) => other.id !== pick.id))}
        />
      ))}
    </ul>
  );
}

interface PickedLineProps {
  pick: Pick;
  photo: SavedPhoto | undefined;
  place: number;
  last: boolean;
  onNote: (note: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

/** The photo's title, or "Photo 12" for one that's no longer saved. */
function pickName(pick: Pick, photo: SavedPhoto | undefined): string {
  return photo?.name ?? `Photo ${pick.id} (gone)`;
}

/** The photo's thumbnail, or an empty square for one that's no longer saved. */
function PickSquare({ photo }: { photo: SavedPhoto | undefined }) {
  return <div className="w-20 shrink-0">{photo && <SavedPhotoSquare photo={photo} />}</div>;
}

function PickedLine({ pick, photo, place, last, onNote, onMove, onRemove }: PickedLineProps) {
  const name = pickName(pick, photo);
  return (
    <li className="flex items-start gap-3">
      <PickSquare photo={photo} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <Textarea
          aria-label={`Note for ${name}`}
          placeholder="A note shown beside it, such as “The same alley at night”"
          maxLength={MAX_PICK_NOTE}
          rows={2}
          value={pick.note}
          onChange={(event) => onNote(event.target.value)}
        />
      </div>
      <div className="flex shrink-0 items-center">
        <MoveArrows name={name} place={place} last={last} onMove={onMove} />
        <Button size="icon-xs" variant="ghost" aria-label={`Take out ${name}`} onClick={onRemove}>
          <XIcon aria-hidden />
        </Button>
      </div>
    </li>
  );
}
