import { EyeOffIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BookSlot } from "@/lib/photo-book";
import { type LocationPart, toggledHidden } from "@/lib/photo-book-hidden";
import { cn } from "@/lib/utils";

interface HidePlacesProps {
  slot: BookSlot;
  /** The parts of the photo's location its caption can leave out. */
  parts: LocationPart[];
  onHidden: (hidden: string[]) => void;
}

/** The button's words: how many parts are hidden, or what it does. */
function triggerText(parts: LocationPart[], hidden: string[]): string {
  const count = parts.filter((p) => hidden.includes(p.key)).length;
  return count > 0 ? `${count} hidden` : "Hide places";
}

/**
 * **Hide places**, under a book photo's caption: the parts of its location (its places, city, state
 * and country), each a button that leaves it out of the caption in this book, as if the photo
 * didn't have it, to keep a long place name short. The photo's own data doesn't change. None for a
 * photo without a location.
 */
export function HidePlaces({ slot, parts, onHidden }: HidePlacesProps) {
  if (parts.length === 0) return null;
  const hidden = slot.hidden ?? [];
  return (
    <Popover>
      <PopoverTrigger
        title="Leave parts of the photo's location out of its caption in this book"
        className="flex items-center gap-1 self-start text-[10px] text-neutral-400 hover:text-white in-data-[preview]:hidden"
      >
        <EyeOffIcon className="size-3" />
        {triggerText(parts, hidden)}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Click a part to leave it out of this caption, as if the photo didn&apos;t have it. The
          photo&apos;s own data stays as it is.
          {slot.caption !== null &&
            " This caption is typed over, so it shows once it's from the template again."}
        </p>
        <div className="flex flex-wrap gap-1">
          {parts.map((part) => {
            const off = hidden.includes(part.key);
            return (
              <button
                key={part.key}
                type="button"
                aria-pressed={off}
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
      </PopoverContent>
    </Popover>
  );
}
