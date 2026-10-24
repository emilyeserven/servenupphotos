import { X } from "lucide-react";
import type { MouseEvent } from "react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { Button } from "@/components/ui/button";
import type { PlacedPhoto } from "@/lib/map-photos";
import { cn } from "@/lib/utils";

/** A cluster that was clicked, with the photos it covers. */
export interface OpenCluster {
  longitude: number;
  latitude: number;
  photos: PlacedPhoto[];
}

/** The open cluster's grid: its photos, and opening one of them. */
interface ClusterGridProps {
  cluster: OpenCluster;
  onOpen: (photo: PlacedPhoto) => void;
}

// Clicks in the grid would otherwise reach the map, which closes it.
function stopAtGrid(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * The photos of a cluster that zooming in can't split, as square thumbnails that open in the
 * lightbox. Its header holds whatever is passed as children, such as a close button.
 */
export function ClusterGrid({
  cluster,
  onOpen,
  className,
  children,
}: ClusterGridProps & { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} onClick={stopAtGrid}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{cluster.photos.length} photos</p>
        {children}
      </div>
      <ClusterThumbnails photos={cluster.photos} onOpen={onOpen} />
    </div>
  );
}

function ClusterThumbnails({
  photos,
  onOpen,
}: {
  photos: PlacedPhoto[];
  onOpen: (photo: PlacedPhoto) => void;
}) {
  return (
    <ul className="grid max-h-[min(18rem,40svh)] grid-cols-3 gap-1.5 overflow-y-auto">
      {photos.map((photo) => (
        <li key={photo.id}>
          <button
            type="button"
            title={photo.title}
            aria-label={`Show ${photo.title}`}
            disabled={!photo.image}
            onClick={() => onOpen(photo)}
            className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-sm bg-neutral-200 outline-none dark:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default"
          >
            {photo.image ? (
              <PhotoThumbnail image={photo.image} />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[0.65rem] leading-tight text-neutral-600 dark:text-neutral-400">
                {photo.title}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The open cluster's grid on phones, as a sheet along the bottom of the map rather than a popup
 * over the cluster, which wouldn't fit above it and would sit under the floating header.
 */
export function ClusterSheet({ onClose, ...grid }: ClusterGridProps & { onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-xl border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.2)] backdrop-blur-sm dark:border-input">
      <ClusterGrid {...grid}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={onClose}
          className="size-7 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X aria-hidden />
        </Button>
      </ClusterGrid>
    </div>
  );
}
