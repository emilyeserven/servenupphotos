import type { Place } from "@/api/places";
import type { CombinedPhoto } from "@/lib/group-photos";
import { PHOTO_FILTERS, type PhotoFilter } from "@/lib/photo-data-filters";
import { isOnMap } from "@/lib/photo-map";

/** The Gallery's On the map filter, without the places it needs to read a photo. */
const MAP_FILTER = {
  key: "map",
  label: "On the map",
  choiceText: { with: "Yes", without: "No" },
} as const;

/**
 * The Gallery's With and Without filters: the same as Photos in Flight's, but with **On the map**
 * (whether the portfolio's map shows the photo) in place of **GPS position**, since a photo with no
 * GPS position of its own can still go on the map at one of its places.
 */
export function galleryFilters(places: Place[]): PhotoFilter[] {
  return PHOTO_FILTERS.map((filter) =>
    filter.key === "gps"
      ? { ...MAP_FILTER, has: (data) => isOnMap(data as CombinedPhoto, places) }
      : filter,
  );
}

/** The Gallery's filters' keys, enough to read them from the URL. */
export const GALLERY_FILTER_KEYS: Pick<PhotoFilter, "key">[] = PHOTO_FILTERS.map(({ key }) => ({
  key: key === "gps" ? MAP_FILTER.key : key,
}));
