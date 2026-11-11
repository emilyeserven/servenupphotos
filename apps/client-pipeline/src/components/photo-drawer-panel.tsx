import { PanelRightCloseIcon } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { GridFilterBar, useGridFilters } from "@/components/gallery/grid-filters";
import { PhotoImage } from "@/components/instagram-picker/photo-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDropTarget } from "@/hooks/use-drop-target";
import { takenDay } from "@/lib/social-focus";
import { photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";

/** The words a page's photo drawer uses for what it adds photos to. */
interface DrawerWords {
  /** Under the heading: how to add a photo, and take one out. */
  help: string;
  /** The checkbox that also lists photos already used, such as "Show photos already in the book". */
  showUsed: string;
  /** The badge on a photo already used, such as "In book". */
  usedBadge: string;
}

/** Taking a photo out by dropping it on the drawer. */
interface TakeOff {
  /** The drag type that marks a drag from the page, not from the drawer itself. */
  fromType: string;
  /** Takes the photo at path out. */
  onRemove: (path: string) => void;
}

interface PhotoDrawerPanelProps {
  photos: SocialPhoto[];
  /** The paths of the photos already used. */
  used: Set<string>;
  /** Adds the photo, as clicking it does. */
  onPick: (photo: SocialPhoto) => void;
  onClose: () => void;
  /** The drag type a photo dragged from the drawer carries its file's path as. */
  dragType: string;
  words: DrawerWords;
  /** Dropping a photo from the page here takes it out; left out, the drawer takes no drops. */
  takeOff?: TakeOff;
}

/** The photos whose title or file name has search, newest taken first, without those used unless shown. */
function searched(photos: SocialPhoto[], search: string, used: Set<string> | null) {
  const query = search.trim().toLowerCase();
  return photos
    .filter((p) => !used?.has(p.path))
    .filter((p) => `${photoName(p)} ${p.file}`.toLowerCase().includes(query))
    .toSorted(
      (a, b) =>
        takenDay(b.data).localeCompare(takenDay(a.data)) ||
        photoName(a).localeCompare(photoName(b)),
    );
}

/**
 * Drag handlers that take a photo dragged off the page out, when the drawer can. A photo dragged
 * from the drawer itself can't be dropped back on it.
 */
function useTakeOffDrop(dragType: string, takeOff: TakeOff | undefined) {
  const { over, handlers } = useDropTarget(dragType, (path) => takeOff?.onRemove(path));
  const onDragOver = (event: DragEvent) => {
    if (takeOff && event.dataTransfer.types.includes(takeOff.fromType)) handlers.onDragOver(event);
  };
  return { over, handlers: { ...handlers, onDragOver } };
}

/**
 * A panel beside a page's content, like the Instagram calendar's photo drawer, listing the photos to
 * drag onto it, with a search and the portfolio Grid's filters. Clicking a photo adds it; with
 * takeOff, a photo dropped here from the page comes out.
 */
export function PhotoDrawerPanel(props: PhotoDrawerPanelProps) {
  const { photos, used, onPick, onClose, dragType, words, takeOff } = props;
  const [search, setSearch] = useState("");
  const [showUsed, setShowUsed] = useState(false);
  const listed = useMemo(
    () => searched(photos, search, showUsed ? null : used),
    [photos, search, showUsed, used],
  );
  const grid = useGridFilters(photos, listed);
  const { over, handlers } = useTakeOffDrop(dragType, takeOff);
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
          <p className="text-muted-foreground text-xs">{words.help}</p>
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
        {words.showUsed}
      </label>
      <div className="shrink-0">
        <GridFilterBar photos={grid.photos} />
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <DrawerPhotos
          photos={grid.shown}
          used={used}
          onPick={onPick}
          dragType={dragType}
          usedBadge={words.usedBadge}
        />
      </div>
    </aside>
  );
}

function DrawerPhotos(props: {
  photos: SocialPhoto[];
  used: Set<string>;
  onPick: (photo: SocialPhoto) => void;
  dragType: string;
  usedBadge: string;
}) {
  const { photos, used, onPick, dragType, usedBadge } = props;
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
              event.dataTransfer.setData(dragType, photo.path);
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
                {used.has(photo.path) && (
                  <span className="bg-primary text-primary-foreground rounded px-1 text-[10px] font-medium">
                    {usedBadge}
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
