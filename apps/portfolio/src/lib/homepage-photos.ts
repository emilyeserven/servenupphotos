import { photos, type Photo, type PhotoImage } from "@/lib/photos";

/** The spotlight zone the homepage's background shows, as written in a photo's spotlightZones. */
const HOMEPAGE_ZONE = "homepage";

/** How many of the newest photos the homepage shows when none are spotlighted on it. */
const FALLBACK_COUNT = 5;

/** A photo with resized versions in R2, which is all the homepage can show. */
export type ImagePhoto = Photo & { image: PhotoImage };

/** Ranks a photo without a place in the order after every photo with one. */
function rank({ spotlightPlace }: Photo): number {
  return spotlightPlace ?? Number.MAX_SAFE_INTEGER;
}

/**
 * The photos behind the homepage: the ones picked for its spotlight zone on the pipeline's Site
 * Spotlight page, in the order they were dragged into there (ones without a place after, newest
 * first), or else the 5 newest photos.
 */
export function homepagePhotos(all: Photo[] = photos): ImagePhoto[] {
  const newest = all
    .filter((photo): photo is ImagePhoto => photo.image !== null)
    .toSorted((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  const spotlighted = newest
    .filter((photo) => photo.spotlightZones.includes(HOMEPAGE_ZONE))
    .toSorted((a, b) => rank(a) - rank(b));
  return spotlighted.length > 0 ? spotlighted : newest.slice(0, FALLBACK_COUNT);
}
