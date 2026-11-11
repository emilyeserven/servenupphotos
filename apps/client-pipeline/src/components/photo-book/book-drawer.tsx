import { PanelRightCloseIcon } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { GridFilterBar, useGridFilters } from "@/components/gallery/grid-filters";
import { PhotoImage } from "@/components/instagram-picker/photo-image";
import { BOOK_PHOTO_DRAG_TYPE, FROM_PAGE_DRAG_TYPE } from "@/components/photo-book/page-slot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDropTarget } from "@/hooks/use-drop-target";
import { takenDay } from "@/lib/social-focus";
import { photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";

interface BookDrawerProps {
  photos: SocialPhoto[];
  /** The paths of the photos already in the book. */
  inBook: Set<string>;
  /** Puts the photo in the book's first empty place. */
  onPick: (photo: SocialPhoto) => void;
  /** Takes the photo at path off the book. */
  onRemove: (path: string) => void;
  onClose: () => void;
}

/** The photos whose title or file name has search, newest taken first, without those in the book unless shown. */
function searched(photos: SocialPhoto[], search: string, inBook: Set<string> | null) {
  const query = search.trim().toLowerCase();
  return photos
    .filter((p) => !inBook?.has(p.path))
    .filter((p) => `${photoName(p)} ${p.file}`.toLowerCase().includes(query))
    .toSorted(
      (a, b) =>
        takenDay(b.data).localeCompare(takenDay(a.data)) ||
        photoName(a).localeCompare(photoName(b)),
    );
}

/**
 * Drag handlers that take a photo dragged off a page out of the book. A photo dragged from the
 * drawer itself can't be dropped back on it.
 */
function useTakeOffDrop(onRemove: (path: string) => void) {
  const { over, handlers } = useDropTarget(BOOK_PHOTO_DRAG_TYPE, onRemove);
  const onDragOver = (event: DragEvent) => {
    if (event.dataTransfer.types.includes(FROM_PAGE_DRAG_TYPE)) handlers.onDragOver(event);
  };
  return { over, handlers: { ...handlers, onDragOver } };
}

/**
 * A panel beside the book, like the Instagram calendar's photo drawer, listing the photos to drag
 * onto a page, with a search and the portfolio Grid's filters. Clicking a photo puts it in the first
 * empty place; a photo dropped here from a page comes off the book.
 */
export function BookDrawer({ photos, inBook, onPick, onRemove, onClose }: BookDrawerProps) {
  const [search, setSearch] = useState("");
  const [showUsed, setShowUsed] = useState(false);
  const listed = useMemo(
    () => searched(photos, search, showUsed ? null : inBook),
    [photos, search, showUsed, inBook],
  );
  const grid = useGridFilters(photos, listed);
  const { over, handlers } = useTakeOffDrop(onRemove);
  return (
    <aside
      aria-label="Photo drawer"
      className={cn(
        "bg-card flex max-h-[calc(100vh-6rem)] flex-col gap-3 rounded-xl border p-4 shadow-sm lg:sticky lg:top-4 lg:w-80 lg:shrink-0 xl:w-96",
        over && "ring-ring ring-2",
      )}
      {...handlers}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Photos</h2>
          <p className="text-muted-foreground text-xs">
            Drag a photo onto a page, or click it to fill the first empty place. Drop a photo from a
            page here to take it out of the book.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close photo drawer" onClick={onClose}>
          <PanelRightCloseIcon />
        </Button>
      </div>
      <Input
        type="search"
        placeholder="Search by title or file name"
        aria-label="Search photos"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={showUsed}
          onChange={(event) => setShowUsed(event.target.checked)}
        />
        Show photos already in the book
      </label>
      <div className="shrink-0">
        <GridFilterBar photos={grid.photos} />
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <DrawerPhotos photos={grid.shown} inBook={inBook} onPick={onPick} />
      </div>
    </aside>
  );
}

function DrawerPhotos(props: {
  photos: SocialPhoto[];
  inBook: Set<string>;
  onPick: (photo: SocialPhoto) => void;
}) {
  const { photos, inBook, onPick } = props;
  if (photos.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">No photos match.</p>;
  }
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label="Photos to add">
      {photos.map((photo) => (
        <li key={photo.path}>
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(BOOK_PHOTO_DRAG_TYPE, photo.path);
              event.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onPick(photo)}
            className="group focus-visible:ring-ring flex w-full cursor-grab flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 active:cursor-grabbing"
          >
            <span className="relative aspect-square overflow-hidden rounded-md border">
              <PhotoImage photo={photo} />
              <span className="absolute top-1 left-1 flex flex-wrap gap-1">
                <DraftBadge
                  data={photo.data}
                  className="rounded bg-violet-600 px-1 text-[10px] font-medium text-white"
                />
                {inBook.has(photo.path) && (
                  <span className="bg-primary text-primary-foreground rounded px-1 text-[10px] font-medium">
                    In book
                  </span>
                )}
              </span>
            </span>
            <span className="truncate text-xs group-hover:underline">{photoName(photo)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
