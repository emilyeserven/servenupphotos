import { ImageIcon, XIcon } from "lucide-react";
import { type CSSProperties, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { useSlotDpi } from "@/components/photo-book/use-slot-dpi";
import { Button } from "@/components/ui/button";
import { useDropTarget } from "@/hooks/use-drop-target";
import { offlineSmallImage } from "@/lib/offline-thumbnails";
import type { BookSlot, SlotPlace } from "@/lib/photo-book";
import { PRINT_DPI } from "@/lib/photo-book-dpi";
import { type BoxSize, slotSources } from "@/lib/photo-book-image";
import { currentData, photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useSize } from "@portfolio/lib/use-size";

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

/**
 * The shape a photo's place keeps on the page, whatever room the page gives it (a named one, or a
 * number for its width over its height), or `fill` for all the room, the photo cropped to fill it.
 */
export type SlotShape = "landscape" | "portrait" | "square" | "fill" | number;

/** Each kept shape's width over its height: 3:2, as the camera takes them, 2:3 turned, and 1:1. */
const SHAPE_RATIO: Record<Exclude<SlotShape, "fill">, number> = {
  landscape: 3 / 2,
  portrait: 2 / 3,
  square: 1,
};

/** The size of a place with shape in the room it's given, which is a size container. */
function shapeStyle(shape: SlotShape): CSSProperties {
  if (shape === "fill") return { width: "100%", height: "100%" };
  const ratio = typeof shape === "number" ? shape : SHAPE_RATIO[shape];
  return { width: `min(100cqw, ${ratio * 100}cqh)`, aspectRatio: ratio };
}

interface PhotoSlotProps {
  slot: BookSlot;
  /** Where the slot is in the book, carried by a drag that starts here. */
  place: SlotPlace;
  /** The page's ID and printed width in inches (null for a size in pixels), to check the photo's resolution. */
  print: { page: string; inches: number | null };
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
  const { slot, place, print, shape, alsoOn, photo, onDrop, onRemove, className } = props;
  const { over, handlers } = useDropTarget(BOOK_PHOTO_DRAG_TYPE, (path, event) =>
    onDrop(path, fromPlace(event.dataTransfer.getData(FROM_PAGE_DRAG_TYPE))),
  );
  const image = useSlotImage(photo);
  const [box, size] = useSize();
  const filled = slot.photo !== "";
  const dpi = useSlotDpi({
    element: box,
    box: size,
    inches: print.inches,
    page: print.page,
    slot: place.slot,
    photo: slot.photo,
    file: photo,
  });
  return (
    <div
      className={cn("flex min-h-0 min-w-0 items-center justify-center", className)}
      style={{ containerType: "size" }}
    >
      <div
        ref={box}
        {...handlers}
        style={shapeStyle(shape)}
        className={cn(
          "group/slot relative overflow-hidden rounded-sm",
          filled ? "bg-neutral-800" : "border border-dashed border-neutral-600",
          over && "ring-ring ring-2",
        )}
      >
        {filled ? (
          <FilledSlot
            slot={slot}
            place={place}
            photo={photo}
            image={image}
            size={size}
            onRemove={onRemove}
          />
        ) : (
          <span className="flex size-full items-center justify-center p-2 text-center text-xs text-neutral-400 in-data-[preview]:hidden">
            Drop a photo here
          </span>
        )}
        <AlsoOn pages={alsoOn} />
        <LowResolution dpi={dpi} />
      </div>
    </div>
  );
}

/** A mark on a photo too small to print sharp in its place, with its resolution; none when it's fine. */
function LowResolution({ dpi }: { dpi: number | null }) {
  if (dpi === null || dpi >= PRINT_DPI) return null;
  return (
    <span
      title={`Prints at ${dpi} dpi here; ${PRINT_DPI} dpi looks sharp. Use a smaller place or a larger photo.`}
      className="absolute top-1 left-1 rounded bg-red-600 px-1 text-[10px] font-medium text-white in-data-[preview]:hidden"
    >
      {dpi} dpi
    </span>
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
  /** The place's size on the screen, which picks the photo version sharp enough for it. */
  size: BoxSize;
  onRemove: () => void;
}) {
  const { slot, place, photo, image, size, onRemove } = props;
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
          <SlotImage photo={photo} image={image} size={size} alt={name} />
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

/**
 * The photo in its place, sharp at any size: the browser picks the resized version from R2 that
 * covers the place at the screen's pixel ratio, starting from the offline Small version, which it
 * goes back to when R2 can't be reached.
 */
function SlotImage(props: {
  photo: SocialPhoto | undefined;
  image: string;
  size: BoxSize;
  alt: string;
}) {
  const { photo, image, size, alt } = props;
  const changed = useChangedPhotoFiles();
  const [failed, setFailed] = useState(false);
  const data = photo && currentData(photo, changed);
  return (
    <img
      src={image}
      {...slotSources(failed ? null : data, size)}
      alt={alt}
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
  );
}
