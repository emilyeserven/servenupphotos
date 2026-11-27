import { EyeOffIcon } from "lucide-react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type BookSlot, type PhotoBook, setHiddenParts } from "@/lib/photo-book";
import { type LocationPart, isLinePart, toggledHidden } from "@/lib/photo-book-hidden";
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

/** The button's words: how many places and lines are hidden on the pages, or what it does. */
function triggerText(photos: HideablePhoto[]): string {
  const hidden = photos.flatMap((p) => p.parts.filter((part) => p.slot.hidden?.includes(part.key)));
  const lines = hidden.filter(isLinePart).length;
  const places = hidden.length - lines;
  const counts = [places > 0 && count(places, "place"), lines > 0 && count(lines, "line")].filter(
    Boolean,
  );
  return counts.length > 0 ? `${counts.join(", ")} hidden` : "Hide places";
}

/** How a part's button looks: a line square-ish, a title bold, and a hidden part struck through. */
function chipClass(part: LocationPart, off: boolean): string {
  return cn(
    "max-w-full truncate border px-2 py-0.5 text-xs",
    isLinePart(part) ? "rounded-md" : "rounded-full",
    part.kind === "Title" && "font-semibold",
    off ? "text-muted-foreground border-dashed line-through" : "bg-primary/10",
  );
}

/** Some of a photo's location parts or lines, each a button that hides it from the caption or shows it again. */
function PartChips({
  photo,
  parts,
  onHidden,
}: {
  photo: HideablePhoto;
  parts: LocationPart[];
  onHidden: (hidden: string[]) => void;
}) {
  const hidden = photo.slot.hidden ?? [];
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part) => {
        const off = hidden.includes(part.key);
        return (
          <button
            key={part.key}
            type="button"
            aria-pressed={off}
            aria-label={`${photo.name}: ${part.kind.toLowerCase()} ${part.name}`}
            title={`${part.kind}: ${off ? "hidden, click to show" : "click to hide"}`}
            onClick={() => onHidden(toggledHidden(hidden, part.key))}
            className={chipClass(part, off)}
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
 * caption in this book, as if the photo didn't have it, to keep a long place name short, then its
 * caption's lines, each a button that leaves the whole line out. The photos' own data doesn't
 * change. None for pages without a photo.
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
          Click a part of a place to leave it out of that photo&apos;s caption, as if the photo
          didn&apos;t have it, or a line to leave the whole line out. Leaving out the first line,
          the title, draws the lines left alike, with none of them bold. The photos&apos; own data
          stays as it is, and a caption typed over shows it once it&apos;s from the template again.
        </p>
        {photos.map((photo) => (
          <HideableRow
            key={`${photo.page}-${photo.index}`}
            photo={photo}
            onHidden={(hidden) =>
              update(setHiddenParts(book, { page: photo.page, slot: photo.index }, hidden))
            }
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** A photo's name, its location parts, and its caption's lines, each a button that hides it. */
function HideableRow({
  photo,
  onHidden,
}: {
  photo: HideablePhoto;
  onHidden: (hidden: string[]) => void;
}) {
  const lines = photo.parts.filter(isLinePart);
  const places = photo.parts.filter((part) => !isLinePart(part));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">{photo.name}</span>
      <PartChips photo={photo} parts={places} onHidden={onHidden} />
      {lines.length > 0 && <span className="text-muted-foreground text-xs">Lines</span>}
      <PartChips photo={photo} parts={lines} onHidden={onHidden} />
    </div>
  );
}
