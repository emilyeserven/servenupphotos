import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { type Photo, type PhotoImage } from "@/lib/photos";
import { showablePhoto } from "@/lib/shown-photo";
import { storedValue } from "@/lib/stored-value";
import { cn } from "@/lib/utils";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/** Whether the More like this drawer is open, remembered in this browser between photos and visits. */
const drawerOpen = storedValue("servenup-more-like-this", (stored) => stored === true);

/** Opens the More like this drawer, or closes it, as its tab and the M key do. */
export function toggleMoreLikeThis() {
  drawerOpen.set(!drawerOpen.get());
}

/**
 * The More like this drawer down the left of the photo viewer: a short, faint tab with an arrow on
 * the left edge that slides in, over the photo's left side, a list of the photos related to this
 * one, each with its title and, for the ones picked by hand on the pipeline's Related Photos page,
 * its note. The picked ones
 * come first, then the ones the pipeline found. It's left out for a photo without any. Clicking one
 * shows it in the viewer, and the drawer stays open for it.
 */
export function MoreLikeThis({
  photo,
  onShow,
}: {
  photo: ImagePhoto;
  /** Shows one of the related photos in the viewer. */
  onShow: (photo: ImagePhoto) => void;
}) {
  const open = drawerOpen.use();
  const related = relatedTo(photo);
  if (related.length === 0) return null;
  return (
    // Over the photo's left side, so the photo keeps its size and padding whether it's open or not.
    <div className="absolute inset-y-0 left-0 z-10 flex items-center">
      {/* Columns from 0fr to 1fr, so the drawer slides in to its own width. */}
      <div
        className={cn(
          "grid h-full transition-[grid-template-columns] duration-300",
          open ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
        )}
      >
        <div id="more-like-this" inert={!open} className="min-w-0 overflow-hidden">
          {open && <RelatedList related={related} onShow={onShow} />}
        </div>
      </div>
      <DrawerTab open={open} />
    </div>
  );
}

/**
 * The short tab on the left edge, with a right arrow while it's closed and a left arrow while
 * open. Closed, it's faint until the pointer comes near: the strip around it, a little wider than
 * the tab, brings it up when hovered.
 */
function DrawerTab({ open }: { open: boolean }) {
  const Icon = open ? ChevronLeftIcon : ChevronRightIcon;
  const label = open ? "Hide more like this" : "Show more like this";
  return (
    <div className="group/tab flex h-40 w-6 items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="more-like-this"
        title={`${label} (M)`}
        onClick={toggleMoreLikeThis}
        className={cn(
          "flex h-14 w-4 items-center justify-center rounded-r-md bg-white/15 text-white outline-none transition-opacity duration-200 group-hover/tab:opacity-100 hover:bg-white/25 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/60",
          open ? "opacity-100" : "opacity-20 pointer-coarse:opacity-40",
        )}
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}

/** The drawer's list of related photos, one per line, scrolling down. */
function RelatedList({
  related,
  onShow,
}: {
  related: ShownRelated[];
  onShow: (photo: ImagePhoto) => void;
}) {
  return (
    <div className="flex h-full w-[min(18rem,80vw)] flex-col border-r border-white/10 bg-neutral-900/95">
      <p className="px-4 pt-3 pb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
        More like this
      </p>
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {related.map((item) => (
          <li key={item.photo.id}>
            <RelatedItem item={item} onShow={onShow} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One related photo: its square thumbnail, with its title and note to the right, showing it when clicked. */
function RelatedItem({
  item,
  onShow,
}: {
  item: ShownRelated;
  onShow: (photo: ImagePhoto) => void;
}) {
  const { photo, note } = item;
  return (
    <button
      type="button"
      aria-label={`Show ${photo.title}`}
      onClick={() => onShow(photo)}
      className="flex w-full items-start gap-3 rounded-md p-2 text-left outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <span className="block size-16 shrink-0 overflow-hidden rounded-md bg-white/10">
        <PhotoThumbnail image={photo.image} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium">{photo.title}</span>
        {note && <span className="line-clamp-3 text-xs text-white/60">{note}</span>}
      </span>
    </button>
  );
}

/** How many photos the drawer shows at most. */
const RELATED_COUNT = 6;

/** A related photo the viewer can show, with its note. */
interface ShownRelated {
  photo: ImagePhoto;
  note: string | null;
}

/** The photos the drawer shows for photo, in order, leaving out any the viewer can't show. */
function relatedTo(photo: Photo): ShownRelated[] {
  return photo.related
    .flatMap(({ id, note }) => {
      const shown = showablePhoto(id);
      return shown ? [{ photo: shown, note }] : [];
    })
    .slice(0, RELATED_COUNT);
}
