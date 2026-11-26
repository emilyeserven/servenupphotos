import { EyeOffIcon } from "lucide-react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type BookSlot, type PhotoBook, setHiddenParts } from "@/lib/photo-book";
import { type LocationPart, toggledHidden } from "@/lib/photo-book-hidden";
import { photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { count } from "@portfolio/lib/words";

/** One photo on a page or spread with the parts of its location its caption can leave out. */
interface HideablePhoto {
  /** The photo's name: its title, or else its file. */
  name: string;
  slot: BookSlot;
  /** Where it is in the book. */
  page: number;
  index: number;
  parts: LocationPart[];
}

/** The photos on the pages that have a location, in page order. */
function hideablePhotos(
  book: PhotoBook,
  pages: PhotoBook["pages"],
  look: PageLook,
): HideablePhoto[] {
  return pages.flatMap((p) => {
    const page = book.pages.indexOf(p);
    return p.slots.flatMap((slot, index) => {
      const photo = look.photos.get(slot.photo);
      const parts = photo ? look.partsFor(slot) : [];
      return photo && parts.length > 0
        ? [{ name: photoName(photo), slot, page, index, parts }]
        : [];
    });
  });
}

/** The button's words: how many parts are hidden on the pages, or what it does. */
function triggerText(photos: HideablePhoto[]): string {
  const hidden = photos.reduce(
    (n, p) => n + p.parts.filter((part) => p.slot.hidden?.includes(part.key)).length,
    0,
  );
  return hidden > 0 ? `${count(hidden, "place")} hidden` : "Hide places";
}

/** A photo's location parts, each a button that hides it from the caption or shows it again. */
function PartChips({
  photo,
  onHidden,
}: {
  photo: HideablePhoto;
  onHidden: (hidden: string[]) => void;
}) {
  const hidden = photo.slot.hidden ?? [];
  return (
    <div className="flex flex-wrap gap-1">
      {photo.parts.map((part) => {
        const off = hidden.includes(part.key);
        return (
          <button
            key={part.key}
            type="button"
            aria-pressed={off}
            aria-label={`${photo.name}: ${part.kind.toLowerCase()} ${part.name}`}
            title={`${part.kind}: ${off ? "hidden, click to show" : "click to hide"}`}
            onClick={() => onHidden(toggledHidden(hidden, part.key))}
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs",
              off ? "text-muted-foreground border-dashed line-through" : "bg-primary/10",
            )}
          >
            {part.name}
          </button>
        );
      })}
    </div>
  );
}

interface HidePlacesProps {
  book: PhotoBook;
  /** The page, or a spread's two pages. */
  pages: PhotoBook["pages"];
  look: PageLook;
  update: (book: PhotoBook) => void;
}

/**
 * **Hide places**, among a page or spread's controls: each of its photos with the parts of its
 * location (its places, city, state and country), each a button that leaves it out of that photo's
 * caption in this book, as if the photo didn't have it, to keep a long place name short. The
 * photos' own data doesn't change. None for pages without a photo with a location.
 */
export function HidePlaces({ book, pages, look, update }: HidePlacesProps) {
  const photos = hideablePhotos(book, pages, look);
  if (photos.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="xs"
          variant="ghost"
          title="Leave parts of photos' locations out of their captions in this book"
        >
          <EyeOffIcon />
          {triggerText(photos)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3 p-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Click a part to leave it out of that photo&apos;s caption, as if the photo didn&apos;t
          have it. The photos&apos; own data stays as it is, and a caption typed over shows it once
          it&apos;s from the template again.
        </p>
        {photos.map((photo) => (
          <div key={`${photo.page}-${photo.index}`} className="flex flex-col gap-1">
            <span className="text-xs font-medium">{photo.name}</span>
            <PartChips
              photo={photo}
              onHidden={(hidden) =>
                update(setHiddenParts(book, { page: photo.page, slot: photo.index }, hidden))
              }
            />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
