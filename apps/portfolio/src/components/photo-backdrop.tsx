import { useState } from "react";
import { BackdropCaption } from "@/components/backdrop-caption";
import type { ImagePhoto } from "@/lib/spotlight-zones";
import { objectPosition } from "@/lib/spotlight-focus";
import { useArrowKeys } from "@/lib/use-arrow-keys";
import { useTurn } from "@/lib/use-turn";
import { cn } from "@/lib/utils";

/** How long each photo shows behind the page, in milliseconds. */
const BACKDROP_MS = 7000;

/**
 * Whether the photo at index is the one showing, or the one before or after it, which are the
 * only ones kept on the page: the one before is still fading out, and the one after loads ahead.
 */
function isNear(index: number, turn: number, count: number): boolean {
  const ahead = (index - turn + count) % count;
  return ahead <= 1 || ahead === count - 1;
}

/**
 * Photos filling the screen behind a page, fading in and out in turn under 20% black so the page
 * stays readable, with the showing photo's title and a link to it on the map at the bottom. Each
 * photo keeps its focus point in view when it's cropped. The left and right arrow keys show
 * the photo before or after, and the next one waits its full time again. With reduced motion the
 * first photo stays until an arrow key moves on. A photo fades in only once it has loaded.
 */
export function PhotoBackdrop({ photos }: { photos: ImagePhoto[] }) {
  const { turn, step } = useTurn(photos.length, BACKDROP_MS);
  useArrowKeys(step);
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(new Set());
  const current = photos[turn];
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      {photos.map(
        (photo, index) =>
          isNear(index, turn, photos.length) && (
            <BackdropImage
              key={photo.id}
              photo={photo}
              showing={index === turn}
              loaded={loaded.has(photo.id)}
              onLoad={() => setLoaded((ids) => new Set(ids).add(photo.id))}
            />
          ),
      )}
      <div aria-hidden className="absolute inset-0 bg-black/20" />
      {current && <BackdropCaption photo={current} />}
    </div>
  );
}

/**
 * One photo of the backdrop, seen only while it's showing and has loaded. The showing photo is the
 * page's largest image, so it's fetched first; the one loading ahead waits behind it.
 */
function BackdropImage({
  photo,
  showing,
  loaded,
  onLoad,
}: {
  photo: ImagePhoto;
  showing: boolean;
  loaded: boolean;
  onLoad: () => void;
}) {
  return (
    <img
      src={photo.image.src}
      srcSet={photo.image.srcSet}
      sizes="100vw"
      alt=""
      aria-hidden
      fetchPriority={showing ? "high" : "low"}
      onLoad={onLoad}
      style={{ objectPosition: objectPosition(photo.spotlightFocus) }}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-2000 motion-reduce:transition-none",
        showing && loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
