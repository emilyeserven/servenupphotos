import { photos, type Photo, type PhotoImage } from "@/lib/photos";

/** A photo with resized versions in R2, which is all a spotlight zone can show. */
export type ImagePhoto = Photo & { image: PhotoImage };

/** A spot on the portfolio that shows the photos picked for it on the pipeline's Site Spotlight page. */
export interface SpotlightZone {
  /** What a photo's spotlightZones holds, such as "homepage". */
  id: string;
  label: string;
  /** Where the zone's photos show. */
  description: string;
}

/** The spotlight zone the homepage's background shows. */
export const HOMEPAGE_ZONE = "homepage";

/** Every spotlight zone, in the order the Spotlight page lists them. */
export const spotlightZones: SpotlightZone[] = [
  {
    id: HOMEPAGE_ZONE,
    label: "Homepage",
    description: "Fading in and out behind the homepage.",
  },
];

/** Ranks a photo without a place in the order after every photo with one. */
function rank({ spotlightPlace }: Photo): number {
  return spotlightPlace ?? Number.MAX_SAFE_INTEGER;
}

/** The photos with images, newest first. */
export function newestWithImages(all: Photo[]): ImagePhoto[] {
  return all
    .filter((photo): photo is ImagePhoto => photo.image !== null)
    .toSorted((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

/**
 * The photos picked for the zone, in the order they were dragged into on Site Spotlight, with ones
 * without a place after, newest first.
 */
export function zonePhotos(zone: string, all: Photo[] = photos): ImagePhoto[] {
  return newestWithImages(all)
    .filter((photo) => photo.spotlightZones.includes(zone))
    .toSorted((a, b) => rank(a) - rank(b));
}
