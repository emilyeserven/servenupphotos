import { ImageIcon, XIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import { useDropTarget } from "@/hooks/use-drop-target";
import { offlineSmallImage } from "@/lib/offline-thumbnails";
import type { BookSlot, SlotPlace } from "@/lib/photo-book";
import { currentData, photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";

/** A photo dragged from the drawer or a page, as its file's path. */
export const BOOK_PHOTO_DRAG_TYPE = "application/x-photo-book-photo";

/**
 * Marks a drag that started on a page, with the place it started from as `page:slot`, so dropping it
 * on another place moves it, and dropping it on the drawer takes it off the page.
 */
export const FROM_PAGE_DRAG_TYPE = "application/x-photo-book-from-page";

/** The place a drag from a page started from, written as FROM_PAGE_DRAG_TYPE's data. */
function fromPlaceText(place: SlotPlace): string {
  return `${place.page}:${place.slot}`;
}

/** The place in FROM_PAGE_DRAG_TYPE's data; undefined for a drag from the drawer. */
export function fromPlace(text: string): SlotPlace | undefined {
  const [page, slot] = text.split(":").map(Number);
  return Number.isInteger(page) && Number.isInteger(slot)
    ? { page: page as number, slot: slot as number }
    : undefined;
}

/** The shape a photo's place keeps on the page, whatever room the page gives it. */
export type SlotShape = "landscape" | "portrait";

/** Each shape's width over its height: 3:2, as the camera takes them, and 2:3 turned. */
const SHAPE_RATIO: Record<SlotShape, number> = { landscape: 3 / 2, portrait: 2 / 3 };

interface PhotoSlotProps {
  slot: BookSlot;
  /** Where the slot is in the book, carried by a drag that starts here. */
  place: SlotPlace;
  shape: SlotShape;
  /** The numbers of the other pages in the book with the same photo; none when it's only here. */
  alsoOn: number[];
  /** The slot's photo, when it has one the page can find. */
  photo: SocialPhoto | undefined;
  /** Puts the photo at path here. */
  onDrop: (path: string, from: SlotPlace | undefined) => void;
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
 * or a dashed box to drop one on. It keeps its shape, as large as the room it's given allows.
 */
export function PhotoSlot(props: PhotoSlotProps) {
  const { slot, place, shape, alsoOn, photo, onDrop, onRemove, className } = props;
  const { over, handlers } = useDropTarget(BOOK_PHOTO_DRAG_TYPE, (path, event) =>
    onDrop(path, fromPlace(event.dataTransfer.getData(FROM_PAGE_DRAG_TYPE))),
  );
  const image = useSlotImage(photo);
  const filled = slot.photo !== "";
  const ratio = SHAPE_RATIO[shape];
  return (
    <div
      className={cn("flex min-h-0 min-w-0 items-center justify-center", className)}
      style={{ containerType: "size" }}
    >
      <div
        {...handlers}
        style={{ width: `min(100cqw, ${ratio * 100}cqh)`, aspectRatio: ratio }}
        className={cn(
          "group/slot relative overflow-hidden rounded-sm",
          filled ? "bg-neutral-800" : "border border-dashed border-neutral-600",
          over && "ring-ring ring-2",
        )}
      >
        {filled ? (
          <FilledSlot slot={slot} place={place} photo={photo} image={image} onRemove={onRemove} />
        ) : (
          <span className="flex size-full items-center justify-center p-2 text-center text-xs text-neutral-400">
            Drop a photo here
          </span>
        )}
        <AlsoOn pages={alsoOn} />
      </div>
    </div>
  );
}

/** A mark on a photo that's on other pages in the book too, naming them; none when it isn't. */
function AlsoOn({ pages }: { pages: number[] }) {
  if (pages.length === 0) return null;
  return (
    <span className="absolute bottom-1 left-1 rounded bg-amber-500 px-1 text-[10px] font-medium text-white">
      Also on page {pages.join(", ")}
    </span>
  );
}

function FilledSlot(props: {
  slot: BookSlot;
  place: SlotPlace;
  photo: SocialPhoto | undefined;
  image: string | undefined;
  onRemove: () => void;
}) {
  const { slot, place, photo, image, onRemove } = props;
  const name = photo ? photoName(photo) : slot.photo;
  return (
    <>
      <div
        draggable
        title={name}
        onDragStart={(event) => {
          event.dataTransfer.setData(BOOK_PHOTO_DRAG_TYPE, slot.photo);
          event.dataTransfer.setData(FROM_PAGE_DRAG_TYPE, fromPlaceText(place));
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
          <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-neutral-400">
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
