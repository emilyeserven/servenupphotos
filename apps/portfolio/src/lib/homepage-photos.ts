import { photos, type Photo } from "@/lib/photos";
import {
  arranged,
  HOMEPAGE_ZONE,
  type ImagePhoto,
  newestWithImages,
  spotlightPhotos,
} from "@/lib/spotlight-zones";

/** How many of the newest photos the homepage shows when no album is picked for it. */
const FALLBACK_COUNT = 5;

/**
 * The photos behind the homepage: the ones in the album picked for its spotlight zone on the
 * pipeline's Site Spotlight page, sub-albums included, in the album's order, or else the 5 newest
 * photos. Unless the zone is set to keep the album's order, portrait photos come first on a phone
 * held upright and landscape photos first elsewhere, so with no album picked those are the 5
 * newest of that shape where there are that many.
 */
export function homepagePhotos(all: Photo[] = photos, phone = false): ImagePhoto[] {
  const spotlighted = spotlightPhotos(HOMEPAGE_ZONE, phone, all);
  if (spotlighted.length > 0) return spotlighted;
  return arranged(newestWithImages(all), HOMEPAGE_ZONE, phone).slice(0, FALLBACK_COUNT);
}
