import { useState } from "react";
import type { ImagePhoto } from "@/lib/homepage-photos";
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
 * Photos filling the screen behind a page, fading in and out in turn under 60% black so the page
 * stays readable, with the showing photo's title at the bottom. With reduced motion the first
 * photo just stays. A photo fades in only once it has loaded.
 */
export function PhotoBackdrop({ photos }: { photos: ImagePhoto[] }) {
  const turn = useTurn(photos.length, BACKDROP_MS);
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
      <div aria-hidden className="absolute inset-0 bg-black/60" />
      {current && (
        <p className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate text-xs text-white/70">
          {current.title}
        </p>
      )}
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
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-2000 motion-reduce:transition-none",
        showing && loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
