import { albumAndSubAlbums } from "@/lib/groups";
import type { Photo } from "@/lib/photos";

/**
 * The location, album and tag filters as they're named in the URL. A location is one of a
 * country, a city (by its English name) or a place (by its ID); an album also matches the photos
 * in its sub-albums.
 */
export const FILTER_KEYS = ["country", "city", "place", "album", "tag"] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** The location filter's keys, of which a URL sets one at most. */
export const LOCATION_KEYS = ["country", "city", "place"] as const satisfies FilterKey[];

export type LocationKey = (typeof LOCATION_KEYS)[number];

/** The filters every portfolio view shares, kept in the URL; each is left out when it isn't set. */
export type PhotoFilters = Partial<Record<FilterKey, string>>;

/** The filters in the URL's search, leaving out anything that isn't a filter or is empty. */
export function parseFilters(search: Record<string, unknown>): PhotoFilters {
  return Object.fromEntries(
    FILTER_KEYS.flatMap((key) => {
      const value = search[key];
      return typeof value === "string" && value !== "" ? [[key, value]] : [];
    }),
  );
}

/** Whether any filter is set. */
export function hasFilters(filters: PhotoFilters): boolean {
  return Object.keys(filters).length > 0;
}

/** Whether the photo is in the album with the ID or one of its sub-albums. */
function inAlbum(photo: Photo, id: string): boolean {
  const ids = albumAndSubAlbums(id);
  return photo.albums.some((album) => ids.has(album));
}

/** How each filter matches a photo. */
const MATCHES: Record<FilterKey, (photo: Photo, value: string) => boolean> = {
  country: (photo, value) => photo.country === value,
  city: (photo, value) => photo.city === value,
  place: (photo, value) => photo.placeIds.includes(value),
  album: inAlbum,
  tag: (photo, value) => photo.tags.includes(value),
};

/** Whether the photo matches every filter that's set. */
export function matchesFilters(photo: Photo, filters: PhotoFilters): boolean {
  return FILTER_KEYS.every((key) => {
    const value = filters[key];
    return value === undefined || MATCHES[key](photo, value);
  });
}

/** The photos matching every filter that's set, in the same order. */
export function filterPhotos<T extends Photo>(list: T[], filters: PhotoFilters): T[] {
  return hasFilters(filters) ? list.filter((photo) => matchesFilters(photo, filters)) : list;
}

/** The filters with the ones named left out, so a filter's choices can count the photos the others leave. */
export function withoutFilters(filters: PhotoFilters, keys: readonly FilterKey[]): PhotoFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([key]) => !keys.includes(key as FilterKey)),
  );
}
