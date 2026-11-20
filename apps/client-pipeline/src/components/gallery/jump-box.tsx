import { ChevronDownIcon, LocateFixedIcon } from "lucide-react";
import { useState } from "react";
import type { GalleryFile } from "@/components/gallery/gallery-files";
import { KIND_MARKS } from "@/components/gallery/kind-mark";
import { tileImageUrl } from "@/lib/offline-thumbnails";
import { cn } from "@/lib/utils";
import { count } from "@portfolio/lib/words";

/**
 * A box floating at the bottom right listing every draft and Undecided photo, in the page's sort,
 * whether they're shown or not. Picking one turns its Show group on and scrolls to it. It starts
 * collapsed to its count, so it doesn't cover the filters; nothing when there are none.
 */
export function JumpBox({
  entries,
  current,
  onJump,
}: {
  /** The drafts and Undecided photos. */
  entries: GalleryFile[];
  /** The photo last jumped to, marked in the list. */
  current?: string;
  onJump: (entry: GalleryFile) => void;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <aside
      aria-label="Drafts and Undecided photos"
      className="bg-popover text-popover-foreground fixed right-4 bottom-4 z-30 flex w-[min(18rem,calc(100vw-2rem))] flex-col rounded-xl border shadow-lg"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="hover:bg-muted/50 flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm"
      >
        <LocateFixedIcon className="text-muted-foreground size-4" aria-hidden />
        <span className="flex-1 font-medium">Drafts and Undecided</span>
        <span className="text-muted-foreground text-xs">{count(entries.length, "photo")}</span>
        <ChevronDownIcon className={cn("size-4 transition-transform", open || "rotate-180")} />
      </button>
      {open && (
        <ul className="flex max-h-[50svh] flex-col gap-0.5 overflow-y-auto border-t p-1.5">
          {entries.map((entry) => (
            <JumpRow
              key={entry.path}
              entry={entry}
              current={entry.path === current}
              onClick={() => onJump(entry)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

/** One draft or Undecided photo: its thumbnail, name and kind. */
function JumpRow({
  entry,
  current,
  onClick,
}: {
  entry: GalleryFile;
  current: boolean;
  onClick: () => void;
}) {
  const mark = markOf(entry);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={current}
        className="hover:bg-muted aria-[current=true]:bg-muted flex w-full items-center gap-2 rounded-md p-1 text-left text-sm aria-[current=true]:font-medium"
      >
        <RowThumbnail data={entry.edited} />
        <span className="min-w-0 flex-1 truncate" title={entry.name}>
          {entry.name}
        </span>
        <span className={cn("shrink-0 rounded px-1 text-[0.65rem] font-medium", mark.className)}>
          {mark.label}
        </span>
      </button>
    </li>
  );
}

/** The Draft or Undecided mark for the row. */
function markOf(entry: GalleryFile) {
  return entry.kind === "undecided" ? KIND_MARKS.undecided : KIND_MARKS.draft;
}

/** The photo's Square Thumbnail from the offline copy, in a small square. */
function RowThumbnail({ data }: { data: unknown }) {
  const thumbnail = tileImageUrl(data);
  return (
    <span className="bg-muted size-9 shrink-0 overflow-hidden rounded">
      {thumbnail && (
        <img src={thumbnail} alt="" loading="lazy" className="size-full object-cover" />
      )}
    </span>
  );
}
