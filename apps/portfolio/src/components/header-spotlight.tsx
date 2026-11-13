import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { JumpToCover } from "@/components/jump-to-cover";
import { rememberSpotlightPhoto, spotlightStart } from "@/lib/last-spotlight-photo";
import { objectPosition } from "@/lib/spotlight-focus";
import {
  focusIn,
  GRID_HEADER_ZONE,
  type ImagePhoto,
  SETTINGS_HEADER_ZONE,
  spotlightPhotos,
  STATS_HEADER_ZONE,
  TIMELINE_HEADER_ZONE,
  UPRIGHT_PHONE_QUERY,
} from "@/lib/spotlight-zones";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSize } from "@/lib/use-size";
import { isNear, useTurn } from "@/lib/use-turn";
import { cn } from "@/lib/utils";

/** How long each photo shows in a page's header, in milliseconds. */
const HEADER_MS = 7000;

/** The spotlight zone at the top of each page that has one, by the page's path. */
const ZONE_BY_PATH: Record<string, string> = {
  "/grid": GRID_HEADER_ZONE,
  "/timeline": TIMELINE_HEADER_ZONE,
  "/stats": STATS_HEADER_ZONE,
  "/settings": SETTINGS_HEADER_ZONE,
};

/**
 * The zones whose page lists its photos below, so **Jump to Cover Image** has somewhere to go; the
 * Stats and Settings pages show no photos, so their headers have no button.
 */
const JUMP_ZONES: ReadonlySet<string> = new Set([GRID_HEADER_ZONE, TIMELINE_HEADER_ZONE]);

/**
 * The header spotlight of the page showing, such as the Grid Header on the Grid; nothing on a page
 * without one. It sits before the page, so the page's title and filters come after it.
 */
export function PageHeaderSpotlight() {
  const zone = ZONE_BY_PATH[useLocation({ select: (location) => location.pathname })];
  return zone ? <HeaderSpotlight key={zone} zone={zone} /> : null;
}

/**
 * The photos of the spotlight zone picked for a page's header on the pipeline's Site Spotlight
 * page, fading in and out in turn across the top of the page, 30% of the screen's height, fading
 * into the page's background at the bottom. The page's title and filters come after it, and the
 * site menu stays where it is. A zone set to match the screen puts portrait photos first on a phone
 * held upright and landscape photos first elsewhere. A **Jump to Cover Image** button on it scrolls to
 * the photo showing in the page below. Like the homepage, each visit starts on the photo after the
 * one this browser showed here last. With no album picked it shows nothing.
 */
function HeaderSpotlight({ zone }: { zone: string }) {
  const phone = useMediaQuery(UPRIGHT_PHONE_QUERY);
  const [photos] = useState(() => ({
    phone: spotlightPhotos(zone, true),
    wide: spotlightPhotos(zone, false),
  }));
  const shown = phone ? photos.phone : photos.wide;
  if (shown.length === 0) return null;
  return <HeaderPhotos key={String(phone)} photos={shown} zone={zone} />;
}

/** The header's photos, each cropped to fill it with its focus point where its placement says. */
function HeaderPhotos({ photos, zone }: { photos: ImagePhoto[]; zone: string }) {
  // Picked once per visit, from the photo this browser showed here last, so each visit starts on a new one.
  const [start] = useState(() => spotlightStart(zone, photos));
  const { turn } = useTurn(photos.length, HEADER_MS, start);
  const showing = photos[turn];
  useEffect(() => {
    if (showing) rememberSpotlightPhoto(zone, showing);
  }, [zone, showing]);
  const [ref, size] = useSize();
  return (
    <div
      ref={ref}
      // The page's top padding starts under the fade, so its title sits just below the photo.
      className="relative -mb-12 h-[30svh] w-full overflow-hidden bg-background"
    >
      <div aria-hidden className="absolute inset-0">
        <HeaderImages photos={photos} zone={zone} turn={turn} box={size} />
      </div>
      {JUMP_ZONES.has(zone) && <JumpToCover photo={photos[turn]} />}
    </div>
  );
}

interface HeaderImagesProps {
  photos: ImagePhoto[];
  zone: string;
  /** The index of the photo showing. */
  turn: number;
  box: { width: number; height: number };
}

/** The photos showing and near it, fading in and out, and the fade into the page at the bottom. */
function HeaderImages({ photos, zone, turn, box }: HeaderImagesProps) {
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(new Set());
  return (
    <>
      {photos.map(
        (photo, index) =>
          isNear(index, turn, photos.length) && (
            <HeaderImage
              key={photo.id}
              photo={photo}
              zone={zone}
              seen={index === turn && loaded.has(photo.id)}
              showing={index === turn}
              box={box}
              onLoad={() => setLoaded((ids) => new Set(ids).add(photo.id))}
            />
          ),
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-b from-transparent to-background" />
    </>
  );
}

interface HeaderImageProps {
  photo: ImagePhoto;
  /** The zone the header shows, whose focus point and placement crop the photo. */
  zone: string;
  /** Whether it's the photo showing and has loaded. */
  seen: boolean;
  /** Whether it's the photo showing, which is fetched first. */
  showing: boolean;
  /** The header's size, which the photo is cropped to fill. */
  box: { width: number; height: number };
  onLoad: () => void;
}

/** One photo of the header, seen only while it's showing and has loaded. */
function HeaderImage({ photo, zone, seen, showing, box, onLoad }: HeaderImageProps) {
  const { focus, placement } = focusIn(photo, zone);
  return (
    <img
      src={photo.image.src}
      srcSet={photo.image.srcSet}
      sizes="100vw"
      alt=""
      fetchPriority={showing ? "high" : "low"}
      onLoad={onLoad}
      style={{
        objectPosition: objectPosition(focus, placement, photo.image, box),
      }}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-2000 motion-reduce:transition-none",
        seen ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
