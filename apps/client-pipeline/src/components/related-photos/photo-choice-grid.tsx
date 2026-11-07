import { useState } from "react";
import {
  matchesSearch,
  type SavedPhoto,
  SavedPhotoSearch,
  SavedPhotoSquare,
} from "@/components/saved-photo-picker";
import { cn } from "@/lib/utils";

interface PhotoChoiceGridProps {
  photos: readonly SavedPhoto[];
  /** The photo to mark as chosen, by path. */
  chosen?: string;
  /** Paths that can't be chosen, such as photos already picked. */
  disabled?: ReadonlySet<string>;
  onChoose: (photo: SavedPhoto) => void;
}

/** A search box over a scrolling grid of saved photos, each a button that chooses it. */
export function PhotoChoiceGrid({ photos, chosen, disabled, onChoose }: PhotoChoiceGridProps) {
  const [search, setSearch] = useState("");
  const shown = photos.filter((photo) => matchesSearch(photo, search));
  return (
    <div className="flex flex-col gap-3">
      <SavedPhotoSearch value={search} onChange={setSearch} />
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No saved photos match.</p>
      ) : (
        <ul className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6 lg:grid-cols-8">
          {shown.map((photo) => (
            <li key={photo.path}>
              <ChoiceTile
                photo={photo}
                chosen={photo.path === chosen}
                disabled={disabled?.has(photo.path) ?? false}
                onChoose={onChoose}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChoiceTile({
  photo,
  chosen,
  disabled,
  onChoose,
}: {
  photo: SavedPhoto;
  chosen: boolean;
  disabled: boolean;
  onChoose: (photo: SavedPhoto) => void;
}) {
  return (
    <button
      type="button"
      title={photo.name}
      aria-pressed={chosen}
      disabled={disabled}
      onClick={() => onChoose(photo)}
      className={cn(
        "hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full flex-col gap-1 rounded-md p-1 text-left outline-none focus-visible:ring-[3px] disabled:opacity-40",
        chosen && "bg-muted ring-primary ring-2",
      )}
    >
      <SavedPhotoSquare photo={photo} />
      <span className="truncate text-xs">{photo.name}</span>
    </button>
  );
}
