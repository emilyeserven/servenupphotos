import { PanelRightCloseIcon } from "lucide-react";
import { type DragEvent, type ReactNode, useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { GridFilterButton } from "@/components/gallery/grid-filter-button";
import { GridFilterBar, useGridFilters } from "@/components/gallery/grid-filters";
import { PhotoImage } from "@/components/instagram-picker/photo-image";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDropTarget } from "@/hooks/use-drop-target";
import { takenDay } from "@/lib/social-focus";
import { photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { EmptyNote, NO_PHOTOS_MATCH } from "@portfolio/components/empty-note";

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
  /** Takes the photo at path out; from is the drag's fromType data, such as where it was. */
  onRemove: (path: string, from: string) => void;
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
  /**
   * True to list the photos in the order given, such as a photo book's album's, with the portfolio
   * Grid's filters behind a **Filter** button beside the search; left out, newest taken first,
   * with the filters' bar under it.
   */
  inOrder?: boolean;
  /** What the drawer says with no photos given at all, such as before an album is picked. */
  empty?: ReactNode;
}

/** Newest taken first, then by name. */
function byNewest(a: SocialPhoto, b: SocialPhoto): number {
  return (
    takenDay(b.data).localeCompare(takenDay(a.data)) || photoName(a).localeCompare(photoName(b))
  );
}

/**
 * The photos whose title or file name has search, without those used unless shown, newest taken
 * first unless inOrder keeps the order given.
 */
function searched(
  photos: SocialPhoto[],
  search: string,
  used: Set<string> | null,
  inOrder = false,
) {
  const query = search.trim().toLowerCase();
  const found = photos
    .filter((p) => !used?.has(p.path))
    .filter((p) => `${photoName(p)} ${p.file}`.toLowerCase().includes(query));
  return inOrder ? found : found.toSorted(byNewest);
}

/**
 * Drag handlers that take a photo dragged off the page out, when the drawer can. A photo dragged
 * from the drawer itself can't be dropped back on it.
 */
function useTakeOffDrop(dragType: string, takeOff: TakeOff | undefined) {
  const { over, handlers } = useDropTarget(dragType, (path, event) =>
    takeOff?.onRemove(path, event.dataTransfer.getData(takeOff.fromType)),
  );
  const onDragOver = (event: DragEvent) => {
    if (takeOff && event.dataTransfer.types.includes(takeOff.fromType)) handlers.onDragOver(event);
  };
  return { over, handlers: { ...handlers, onDragOver } };
}

/**
 * The drawer's search and its Show used checkbox, and the photos it shows with them: through the
 * portfolio Grid's filters, or, inOrder, in the order given without them.
 */
function useDrawerList(photos: SocialPhoto[], used: Set<string>, inOrder = false) {
  const [search, setSearch] = useState("");
  const [showUsed, setShowUsed] = useState(false);
  const listed = useMemo(
    () => searched(photos, search, showUsed ? null : used, inOrder),
    [photos, search, showUsed, used, inOrder],
  );
  const grid = useGridFilters(photos, listed);
  return {
    search,
    setSearch,
    showUsed,
    setShowUsed,
    shown: grid.shown,
    filterPhotos: grid.photos,
    filterCount: grid.count,
  };
}

/**
 * A panel beside a page's content, like the Instagram calendar's photo drawer, listing the photos to
 * drag onto it, with a search and the portfolio Grid's filters (or, inOrder, in the order given,
 * with the filters in a flyout).
 * Clicking a photo adds it; with takeOff, a photo dropped here from the page comes out.
 */
export function PhotoDrawerPanel(props: PhotoDrawerPanelProps) {
  const { photos, used, onPick, onClose, dragType, words, takeOff, inOrder, empty } = props;
  const { search, setSearch, showUsed, setShowUsed, shown, filterPhotos, filterCount } =
    useDrawerList(photos, used, inOrder);
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
          <SectionTitle as="h2" size="lg">
            Photos
          </SectionTitle>
          <p className="text-muted-foreground text-xs">{words.help}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close photo drawer" onClick={onClose}>
          <PanelRightCloseIcon />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="search"
          placeholder="Search by title or file name"
          aria-label="Search photos"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {inOrder && <GridFilterButton photos={filterPhotos} count={filterCount} />}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={showUsed}
          onChange={(event) => setShowUsed(event.target.checked)}
        />
        {words.showUsed}
      </label>
      {!inOrder && (
        <div className="shrink-0">
          <GridFilterBar photos={filterPhotos} />
        </div>
      )}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <DrawerPhotos
          photos={shown}
          empty={emptyNote(photos.length, empty)}
          used={used}
          onPick={onPick}
          dragType={dragType}
          usedBadge={words.usedBadge}
        />
      </div>
    </aside>
  );
}

/** What the drawer says with nothing to show: empty when it was given no photos at all. */
function emptyNote(given: number, empty: ReactNode): ReactNode {
  return given === 0 && empty ? empty : NO_PHOTOS_MATCH;
}

function DrawerPhotos(props: {
  photos: SocialPhoto[];
  empty: ReactNode;
  used: Set<string>;
  onPick: (photo: SocialPhoto) => void;
  dragType: string;
  usedBadge: string;
}) {
  const { photos, empty, used, onPick, dragType, usedBadge } = props;
  if (photos.length === 0) {
    return <EmptyNote className="py-6 text-center">{empty}</EmptyNote>;
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
