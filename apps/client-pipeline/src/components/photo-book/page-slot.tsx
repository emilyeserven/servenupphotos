import { ImageIcon, RotateCcwIcon, XIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import { useDropTarget } from "@/hooks/use-drop-target";
import { offlineSmallImage } from "@/lib/offline-thumbnails";
import type { BookSlot } from "@/lib/photo-book";
import { currentData, photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";

/** A photo dragged from the drawer or a page, as its file's path. */
export const BOOK_PHOTO_DRAG_TYPE = "application/x-photo-book-photo";

/** Marks a drag that started on a page, so dropping it on the drawer takes it off the book. */
export const FROM_PAGE_DRAG_TYPE = "application/x-photo-book-from-page";

interface PhotoSlotProps {
  slot: BookSlot;
  /** The slot's photo, when it has one the page can find. */
  photo: SocialPhoto | undefined;
  /** Puts the photo at path here. */
  onDrop: (path: string) => void;
  onRemove: () => void;
  className?: string;
}

/** The image the page shows for a photo: its Small version, or else its Square Thumbnail. */
function useSlotImage(photo: SocialPhoto | undefined): string | undefined {
  const changed = useChangedPhotoFiles();
  if (!photo) return undefined;
  return offlineSmallImage(currentData(photo, changed)) ?? photo.image ?? undefined;
}

/**
 * A photo's place on a page: its photo, which can be dragged to another place or onto the drawer,
 * or a dashed box to drop one on.
 */
export function PhotoSlot({ slot, photo, onDrop, onRemove, className }: PhotoSlotProps) {
  const { over, handlers } = useDropTarget(BOOK_PHOTO_DRAG_TYPE, onDrop);
  const image = useSlotImage(photo);
  const filled = slot.photo !== "";
  return (
    <div
      {...handlers}
      className={cn(
        "group/slot relative min-h-0 overflow-hidden rounded-sm",
        filled ? "bg-muted" : "border-muted-foreground/40 border border-dashed",
        over && "ring-ring ring-2",
        className,
      )}
    >
      {filled ? (
        <FilledSlot slot={slot} photo={photo} image={image} onRemove={onRemove} />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center p-2 text-center text-xs">
          Drop a photo here
        </span>
      )}
    </div>
  );
}

function FilledSlot(props: {
  slot: BookSlot;
  photo: SocialPhoto | undefined;
  image: string | undefined;
  onRemove: () => void;
}) {
  const { slot, photo, image, onRemove } = props;
  const name = photo ? photoName(photo) : slot.photo;
  return (
    <>
      <div
        draggable
        title={name}
        onDragStart={(event) => {
          event.dataTransfer.setData(BOOK_PHOTO_DRAG_TYPE, slot.photo);
          event.dataTransfer.setData(FROM_PAGE_DRAG_TYPE, "");
          event.dataTransfer.effectAllowed = "move";
        }}
        className="size-full cursor-grab active:cursor-grabbing"
      >
        {image ? (
          <img
            src={image}
            alt={name}
            draggable={false}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs">
            <ImageIcon className="size-5" />
            {photo ? name : "This photo isn't in the photo files any more"}
          </span>
        )}
      </div>
      <Button
        size="icon-xs"
        variant="secondary"
        aria-label={`Take ${name} off the page`}
        onClick={onRemove}
        className="absolute top-1 right-1 opacity-0 group-hover/slot:opacity-100 focus-visible:opacity-100"
      >
        <XIcon />
      </Button>
    </>
  );
}

interface SlotCaptionProps {
  slot: BookSlot;
  /** What the caption says: the one written by hand, or the template's. */
  text: string;
  onChange: (caption: string | null) => void;
  className?: string;
}

/**
 * A photo's caption, filled in from its data with the book's caption template until it's typed
 * over; typed over, a button puts the template's back.
 */
export function SlotCaption({ slot, text, onChange, className }: SlotCaptionProps) {
  if (slot.photo === "" && slot.caption === null) {
    return (
      <div className={cn("text-muted-foreground/60 text-[10px] italic", className)}>Caption</div>
    );
  }
  return (
    <div className={cn("group/caption relative flex min-h-0 flex-col", className)}>
      <textarea
        aria-label="Caption"
        value={text}
        placeholder="Caption"
        onChange={(event) => onChange(event.target.value)}
        className="hover:bg-muted/60 focus:bg-muted/60 min-h-0 w-full flex-1 resize-none [text-align:inherit] rounded-sm bg-transparent text-[10px] leading-snug outline-none"
      />
      {slot.caption !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Fill the caption in from the caption template again"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-[10px]"
        >
          <RotateCcwIcon className="size-3" />
          From template
        </button>
      )}
    </div>
  );
}
