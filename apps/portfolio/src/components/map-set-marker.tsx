import { pinStyle, stopAtMarker } from "@/components/map-pin-style";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import type { MapDisplay } from "@/lib/map-display";
import type { MapSet } from "@/lib/map-photos";
import { cn } from "@/lib/utils";

/** How far the square behind a Photo Set's photo sits up and to the right, in pixels. */
const STACK_OFFSET = 5;

/** A softer white edge, for a set whose photos are all placed at one of their places. */
const SOFT_RING = "ring-white/40";

/** A square of a Photo Set's marker: rounded, with a white edge and a shadow. */
const SQUARE =
  "absolute inset-0 overflow-hidden rounded-md shadow-md shadow-black/30 ring-2 ring-white";

/**
 * A Photo Set's marker: a photo's square pin with a second square stacked behind it, showing the
 * set's next photo, and how many photos it has in a small badge (unless the display options hide
 * counts). It stays one marker at every zoom, and clicking it opens its photos in a grid.
 */
export function SetMarker({
  set,
  display,
  onOpen,
}: {
  set: MapSet;
  display: MapDisplay;
  onOpen: () => void;
}) {
  const [front, back] = set.photos.filter((photo) => photo.image);
  const count = set.photos.length;
  return (
    <button
      type="button"
      title={`${set.name}: ${count} photos`}
      aria-label={`Show the Photo Set ${set.name}, ${count} photos`}
      onClick={(event) => {
        stopAtMarker(event);
        onOpen();
      }}
      style={pinStyle(display)}
      className="group relative block cursor-pointer outline-none transition-transform hover:scale-110 focus-visible:scale-110"
    >
      <BackSquare photo={back} approximate={set.approximate} />
      <FrontSquare photo={front} approximate={set.approximate} />
      {display.showCounts && <SetCount count={count} />}
    </button>
  );
}

/** A photo in a Photo Set on the map. */
type SetPhoto = MapSet["photos"][number];

/** A set marker's front square, with its first photo's thumbnail. */
function FrontSquare({ photo, approximate }: { photo?: SetPhoto; approximate: boolean }) {
  return (
    <span
      className={cn(SQUARE, "bg-muted group-focus-visible:ring-sky-500", approximate && SOFT_RING)}
    >
      <SquareThumbnail photo={photo} />
    </span>
  );
}

/** The square stacked behind a set marker's, up and to the right, with its next photo faded. */
function BackSquare({ photo, approximate }: { photo?: SetPhoto; approximate: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(SQUARE, "bg-neutral-300 dark:bg-neutral-600", approximate && SOFT_RING)}
      style={{ transform: `translate(${STACK_OFFSET}px, -${STACK_OFFSET}px)` }}
    >
      <span className="block size-full opacity-70">
        <SquareThumbnail photo={photo} />
      </span>
    </span>
  );
}

/** The photo's square thumbnail, or nothing for a photo without an image. */
function SquareThumbnail({ photo }: { photo?: SetPhoto }) {
  return photo?.image ? <PhotoThumbnail image={photo.image} /> : null;
}

/** How many photos the set has, in a small dark badge at its marker's bottom right corner. */
function SetCount({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="absolute -right-1.5 -bottom-1.5 rounded-full bg-black/75 px-1.5 text-[0.65rem] leading-4 font-semibold text-white tabular-nums ring-1 ring-white"
    >
      {count}
    </span>
  );
}
