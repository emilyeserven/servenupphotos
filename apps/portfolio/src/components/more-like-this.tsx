import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
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
 * The More like this drawer along the bottom of the photo viewer, like Lightroom's filmstrip: a
 * short tab with an up arrow that slides up a row of the photos most like this one: the ones
 * picked by hand on the pipeline's Similar Photos page, then the ones it found. Clicking one shows it in the viewer, and the drawer stays open for it.
 */
export function MoreLikeThis({
  photo,
  onShow,
}: {
  photo: ImagePhoto;
  /** Shows one of the similar photos in the viewer. */
  onShow: (photo: ImagePhoto) => void;
}) {
  const open = drawerOpen.use();
  const similar = similarTo(photo);
  if (similar.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <DrawerTab open={open} />
      {/* Rows from 0fr to 1fr, so the drawer slides open to its own height. */}
      <div
        className={cn(
          "grid w-full transition-[grid-template-rows] duration-300",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div id="more-like-this" inert={!open} className="overflow-hidden">
          {open && <SimilarStrip similar={similar} onShow={onShow} />}
        </div>
      </div>
    </div>
  );
}

/** The short tab above the drawer, with an up arrow while it's closed and a down arrow while open. */
function DrawerTab({ open }: { open: boolean }) {
  const Icon = open ? ChevronDownIcon : ChevronUpIcon;
  const label = open ? "Hide more like this" : "Show more like this";
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls="more-like-this"
      title={`${label} (M)`}
      onClick={toggleMoreLikeThis}
      className="flex h-4 w-14 items-center justify-center rounded-t-md bg-white/10 text-white/70 outline-none hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <Icon className="size-4" />
    </button>
  );
}

/** The drawer's row of similar photos, scrolling sideways. */
function SimilarStrip({
  similar,
  onShow,
}: {
  similar: ImagePhoto[];
  onShow: (photo: ImagePhoto) => void;
}) {
  return (
    <div className="border-t border-white/10 bg-white/5 px-4 py-3">
      <p className="mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
        More like this
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {similar.map((other) => (
          <li key={other.id} className="shrink-0">
            <SimilarThumbnail photo={other} onShow={onShow} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One similar photo's square thumbnail, showing it in the viewer when clicked. */
function SimilarThumbnail({
  photo,
  onShow,
}: {
  photo: ImagePhoto;
  onShow: (photo: ImagePhoto) => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={() => onShow(photo)}
      className="block size-20 overflow-hidden rounded-md bg-white/10 opacity-80 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <PhotoThumbnail image={photo.image} />
    </button>
  );
}

/** How many photos the drawer shows at most. */
const SIMILAR_COUNT = 6;

/** The photos the drawer shows for photo, in order, leaving out any the viewer can't show. */
function similarTo(photo: Photo): ImagePhoto[] {
  return photo.similar
    .map(showablePhoto)
    .filter((other): other is ImagePhoto => other !== undefined)
    .slice(0, SIMILAR_COUNT);
}
