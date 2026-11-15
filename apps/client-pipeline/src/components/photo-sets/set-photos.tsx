import { GripVerticalIcon, MapPinOffIcon, XIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { PhotoImage } from "@/components/instagram-picker/photo-image";
import { MoveArrows } from "@/components/move-arrows";
import { TileDropList } from "@/components/tile-drop-list";
import { Button } from "@/components/ui/button";
import { canBeMapped } from "@/lib/photo-sets";
import { photoName } from "@/lib/social-schedule";

/** A photo dragged from the drawer onto a set, as its file's path. */
export const SET_PHOTO_DRAG_TYPE = "application/x-set-photo";

interface SetPhotosProps {
  /** The set's photo IDs, in order. */
  ids: number[];
  /** The photo files by their photo ID. */
  byId: Map<number, SocialPhoto>;
  /** Adds the photo file at path at the end. */
  onAdd: (path: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: number) => void;
}

/**
 * The set's photos in the order the map's popup shows them, the first on its marker, to drag into
 * order or move with each one's arrows. A photo dragged here from the drawer is added at the end.
 */
export function SetPhotos({ ids, byId, onAdd, onMove, onRemove }: SetPhotosProps) {
  return (
    <TileDropList
      items={ids}
      keyOf={(id) => id}
      onMove={onMove}
      dragType={SET_PHOTO_DRAG_TYPE}
      onAdd={onAdd}
      empty="No photos yet. Drag photos here from the drawer, or click them. The map shows a set once it has two photos it can place."
      tile={(id, place) => {
        const photo = byId.get(id);
        const name = photo ? photoName(photo) : `Photo ${id}`;
        return (
          <>
            <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
              {photo && <PhotoImage photo={photo} />}
              <span className="bg-background/85 absolute top-1 left-1 rounded px-1.5 text-xs font-medium tabular-nums">
                {place === 0 ? "1 · on marker" : place + 1}
              </span>
              <NotOnMap photo={photo} />
              <Button
                size="icon-xs"
                variant="secondary"
                className="absolute top-1 right-1"
                aria-label={`Take ${name} out of the set`}
                onClick={() => onRemove(id)}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs" title={name}>
                {name}
              </span>
              <MoveArrows
                name={name}
                place={place}
                last={place === ids.length - 1}
                onMove={onMove}
              />
            </div>
          </>
        );
      }}
    />
  );
}

/** A note on a photo the map can't place, as it has no GPS position or place. */
function NotOnMap({ photo }: { photo: SocialPhoto | undefined }) {
  if (!photo || canBeMapped(photo)) return null;
  return (
    <span
      className="bg-background/85 absolute bottom-1 left-1 flex items-center gap-1 rounded px-1.5 text-xs"
      title="It has no GPS position or place, so the map can't show it."
    >
      <MapPinOffIcon className="size-3" aria-hidden />
      Not on the map
    </span>
  );
}
