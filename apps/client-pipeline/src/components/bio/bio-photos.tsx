import { GripVerticalIcon, ImageOffIcon, XIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { MoveArrows } from "@/components/move-arrows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDragOrder } from "@/hooks/use-drag-order";
import { useDropTarget } from "@/hooks/use-drop-target";
import { type BioPhoto, bioPhotoKey, bioPhotoName, bioTileImage } from "@/lib/bio";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import { photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";

/** A photo dragged from the drawer onto the bio's photos, as its file's path. */
export const BIO_PHOTO_DRAG_TYPE = "application/x-bio-photo";

/** What the bio's photos can do to the bio. */
export interface BioPhotoActions {
  onMove: (from: number, to: number) => void;
  onRemove: (place: number) => void;
  onAlt: (place: number, alt: string) => void;
  /** Adds the portfolio photo at path at the end. */
  onAdd: (path: string) => void;
}

interface BioPhotosProps {
  photos: BioPhoto[];
  /** The portfolio's photo files, by path. */
  byPath: Map<string, SocialPhoto>;
  actions: BioPhotoActions;
}

/**
 * The bio's photos in the order the bio shows them, to drag into order or move with each one's
 * arrows. A photo dragged here from the drawer is added at the end.
 */
export function BioPhotos({ photos, byPath, actions }: BioPhotosProps) {
  const drag = useDragOrder(actions.onMove);
  const drop = useDropTarget(BIO_PHOTO_DRAG_TYPE, actions.onAdd);
  return (
    <div
      {...drop.handlers}
      className={cn("rounded-lg", drop.over && "ring-ring ring-2 ring-offset-2")}
    >
      {photos.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          No photos yet. Upload a self-portrait, or drag a photo here from the drawer.
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {photos.map((photo, place) => (
            <li
              key={bioPhotoKey(photo)}
              draggable
              onDragStart={(event) => drag.start(place, event)}
              onDragEnter={() => drag.enter(place)}
              onDragOver={(event) => event.preventDefault()}
              onDragEnd={drag.end}
              className={cn(
                "bg-card flex cursor-grab flex-col gap-1.5 rounded-lg border p-1.5 active:cursor-grabbing",
                drag.dragging === place && "border-primary opacity-50",
              )}
            >
              <BioTile
                photo={photo}
                site={photo.photo === undefined ? undefined : byPath.get(photo.photo)}
                place={place}
                last={place === photos.length - 1}
                actions={actions}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface BioTileProps {
  photo: BioPhoto;
  /** The portfolio photo's file, when it's one the page can find. */
  site: SocialPhoto | undefined;
  place: number;
  last: boolean;
  actions: BioPhotoActions;
}

/** One bio photo: its picture and place, what kind it is, arrows, remove, and a self-portrait's alt text. */
function BioTile({ photo, site, place, last, actions }: BioTileProps) {
  const name = bioPhotoName(photo, site && photoName(site));
  return (
    <>
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
        <TileImage photo={photo} site={site} name={name} />
        <span className="bg-background/85 absolute top-1 left-1 rounded px-1.5 text-xs font-medium tabular-nums">
          {place + 1}
        </span>
        <KindBadge portrait={photo.portrait !== undefined} />
        <Button
          size="icon-xs"
          variant="secondary"
          className="absolute top-1 right-1"
          aria-label={`Take ${name} off the bio`}
          onClick={() => actions.onRemove(place)}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs" title={name}>
          {name}
        </span>
        <MoveArrows name={name} place={place} last={last} onMove={actions.onMove} />
      </div>
      {photo.portrait && (
        <Input
          aria-label={`Alt text of self-portrait ${place + 1}`}
          placeholder="Alt text"
          value={photo.portrait.alt}
          className="h-7 text-xs"
          onChange={(event) => actions.onAlt(place, event.target.value)}
        />
      )}
    </>
  );
}

/** The self-portrait's small version, or the portfolio photo's Square Thumbnail, or a placeholder. */
function TileImage(props: { photo: BioPhoto; site: SocialPhoto | undefined; name: string }) {
  const { photo, site, name } = props;
  const image = bioTileImage(photo, site?.image);
  if (!image) {
    return (
      <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 text-xs">
        <ImageOffIcon className="size-5" aria-hidden />
        {site ? "No image" : "Photo not found"}
      </div>
    );
  }
  return (
    <img
      src={offlineImageUrl(image)}
      alt={name}
      loading="lazy"
      draggable={false}
      className="size-full object-cover"
    />
  );
}

/** Marks a self-portrait as only on the bio, and a portfolio photo as one. */
function KindBadge({ portrait }: { portrait: boolean }) {
  return (
    <span
      className={cn(
        "absolute bottom-1 left-1 rounded px-1.5 text-[10px] font-medium",
        portrait ? "bg-violet-600 text-white" : "bg-background/85",
      )}
    >
      {portrait ? "Bio only" : "Portfolio photo"}
    </span>
  );
}
