import { photos, type Photo } from "@/lib/photos";
import {
  HOMEPAGE_ZONE,
  type ImagePhoto,
  newestWithImages,
  zonePhotos,
} from "@/lib/spotlight-zones";

/** How many of the newest photos the homepage shows when no album is picked for it. */
const FALLBACK_COUNT = 5;

/** Whether the photo is taller than it's wide, as it's shown. */
function isPortrait({ image }: ImagePhoto): boolean {
  return image.height > image.width;
}

/** The list with its portrait photos first, each part keeping its order. */
function portraitsFirst(list: ImagePhoto[]): ImagePhoto[] {
  return [...list.filter(isPortrait), ...list.filter((photo) => !isPortrait(photo))];
}

/** The list as a phone shows it, with portrait photos first, or as it is elsewhere. */
function arranged(list: ImagePhoto[], phone: boolean): ImagePhoto[] {
  return phone ? portraitsFirst(list) : list;
}

/**
 * The photos behind the homepage: the ones in the album picked for its spotlight zone on the
 * pipeline's Site Spotlight page, sub-albums included, in the album's order, or else the 5 newest photos.
 * On a phone held upright, portrait photos come first, so with no album picked those are the 5
 * newest portrait photos where there are that many.
 */
export function homepagePhotos(all: Photo[] = photos, phone = false): ImagePhoto[] {
  const spotlighted = zonePhotos(HOMEPAGE_ZONE, all);
  if (spotlighted.length > 0) return arranged(spotlighted, phone);
  return arranged(newestWithImages(all), phone).slice(0, FALLBACK_COUNT);
}
