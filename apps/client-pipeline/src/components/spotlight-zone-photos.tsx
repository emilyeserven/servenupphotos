import { GripVerticalIcon, ImageIcon, XIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { Button } from "@/components/ui/button";
import { photoName } from "@/lib/social-schedule";
import { useDropTarget } from "@/hooks/use-drop-target";
import { cn } from "@/lib/utils";

/** Where a zone photo's "Draft" label goes: its bottom right corner. */
export const DRAFT_BADGE =
  "pointer-events-none absolute right-1 bottom-1 rounded bg-violet-600 px-1 text-[10px] font-medium text-white";

/** The type the dragged photo's place in the zone is carried under. */
const DRAG_TYPE = "application/x-spotlight-index";

interface ZonePhotosProps {
  /** The zone's photos, in their order. */
  photos: SocialPhoto[];
  /** Whether the photo's zones or place aren't committed yet. */
  isUnsaved: (photo: SocialPhoto) => boolean;
  /** Moves the photo at index from to index to. */
  onMove: (from: number, to: number) => void;
  onRemove: (photo: SocialPhoto) => void;
}

/**
 * A zone's photos in their order, numbered from 1. Dragging a photo onto another moves it to that
 * place, shifting the ones between.
 */
export function ZonePhotos({ photos, isUnsaved, onMove, onRemove }: ZonePhotosProps) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
      {photos.map((photo, index) => (
        <ZonePhoto
          key={photo.path}
          photo={photo}
          index={index}
          unsaved={isUnsaved(photo)}
          onDropAt={(from) => onMove(from, index)}
          onRemove={() => onRemove(photo)}
        />
      ))}
    </ul>
  );
}

interface ZonePhotoProps {
  photo: SocialPhoto;
  index: number;
  unsaved: boolean;
  onDropAt: (from: number) => void;
  onRemove: () => void;
}

/** A photo in a zone, with its place, which can be dragged to another place or taken out. */
function ZonePhoto({ photo, index, unsaved, onDropAt, onRemove }: ZonePhotoProps) {
  const name = photoName(photo);
  const { over, handlers } = useDropTarget(DRAG_TYPE, (from) => onDropAt(Number(from)));
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, String(index));
        event.dataTransfer.effectAllowed = "move";
      }}
      {...handlers}
      title={`${name}. Drag to move it`}
      className={cn(
        "relative aspect-square cursor-grab overflow-hidden rounded-md border active:cursor-grabbing",
        over && "ring-ring ring-2",
      )}
    >
      <Thumbnail photo={photo} />
      <span className="bg-background/80 pointer-events-none absolute top-1 left-1 flex items-center rounded px-1 text-xs font-medium">
        <GripVerticalIcon className="size-3" aria-hidden />
        {index + 1}
      </span>
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-1 right-1 size-6"
        aria-label={`Take ${name} out`}
        onClick={onRemove}
      >
        <XIcon className="size-3.5" />
      </Button>
      <DraftBadge data={photo.data} className={DRAFT_BADGE} />
      {unsaved && <UnsavedDot />}
    </li>
  );
}

function UnsavedDot() {
  return (
    <span className="bg-primary absolute bottom-1 left-1 size-2 rounded-full">
      <span className="sr-only">Not committed</span>
    </span>
  );
}

/** The photo's Square Thumbnail or smallest version, or an image icon without one. */
export function Thumbnail({ photo }: { photo: SocialPhoto }) {
  if (!photo.image) {
    return (
      <span className="bg-muted text-muted-foreground flex size-full items-center justify-center">
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={photo.image}
      alt=""
      draggable={false}
      loading="lazy"
      className="size-full object-cover"
    />
  );
}
