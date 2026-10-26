import { GalleryHorizontal } from "lucide-react";
import type { PlacedPhoto } from "@/lib/map-photos";

/**
 * A **Browse** button that opens the photo viewer on the newest of the photos the map has in view,
 * stepping through the rest of them; it can't be pressed while none are in view.
 */
export function BrowseInViewButton({
  photos,
  onOpen,
}: {
  /** The photos in view the viewer can show, newest first. */
  photos: PlacedPhoto[];
  onOpen: (photo: PlacedPhoto, photos: PlacedPhoto[]) => void;
}) {
  const [first] = photos;
  return (
    <button
      type="button"
      disabled={!first}
      onClick={() => {
        if (first) onOpen(first, photos);
      }}
      title={first ? `Step through the ${photos.length} photos in view` : "No photos in view"}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:border-input"
    >
      <GalleryHorizontal className="size-4 text-muted-foreground" aria-hidden />
      {/* Just the icon on phones, so the map's controls fit on one row. */}
      <span className="max-md:sr-only">Browse</span>
    </button>
  );
}
