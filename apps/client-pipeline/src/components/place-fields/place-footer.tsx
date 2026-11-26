import { ArrowUpDownIcon, FolderTreeIcon, PlusIcon } from "lucide-react";
import type { PhotoPlace } from "@/api/places";
import type { Places } from "@/components/place-fields/use-places";
import { Button } from "@/components/ui/button";
import { unrelatedPair } from "@/lib/place-hierarchy";
import { placePhrase } from "@/lib/place-joins";

/**
 * When two places are chosen and neither is in the other, offers to put the first in the second,
 * so choosing the first again adds the second on its own.
 */
export function ParentOffer({
  rows,
  all,
  disabled,
}: {
  rows: PhotoPlace[];
  all: Places;
  disabled: boolean;
}) {
  const pair = unrelatedPair(rows, all.places);
  if (!pair) return null;
  const { child, parent } = pair;
  return (
    <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
      <span>
        Is {child.name} in {parent.name}?
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || all.busy}
        onClick={() => all.save.mutate({ ...child, parent: parent.id })}
      >
        <FolderTreeIcon /> Put it in {parent.name}
      </Button>
    </div>
  );
}

interface PlaceFooterProps {
  rows: PhotoPlace[];
  all: Places;
  disabled: boolean;
  onAddSecond: () => void;
  /** Swaps the first and second places. */
  onSwap: () => void;
}

/** The places as a phrase, and adding a second place or swapping the two. */
export function PlaceFooter({ rows, all, disabled, onAddSecond, onSwap }: PlaceFooterProps) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">{phraseText(rows, all)}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={rows.length === 1 ? onAddSecond : onSwap}
        >
          {rows.length === 1 ? (
            <>
              <PlusIcon /> Add a second place
            </>
          ) : (
            <>
              <ArrowUpDownIcon /> Swap places
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** The places as a quoted phrase, or what to do when none is chosen. */
function phraseText(rows: PhotoPlace[], all: Places): string {
  const phrase = placePhrase(rows, all.places, all.names);
  return phrase ? `“${phrase}”` : "Choose a place, and how the photo relates to it.";
}
