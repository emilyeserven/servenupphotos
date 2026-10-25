import { albumAndSubAlbums } from "@/lib/groups";
import type { Photo } from "@/lib/photos";

/** The location filter's keys: countries, cities (by their English names) and places (by their IDs). */
export const LOCATION_KEYS = ["country", "state", "city", "place"] as const;

export type LocationKey = (typeof LOCATION_KEYS)[number];

/** The album, tag and genre filters' keys; an album also matches the photos in its sub-albums. */
const GROUP_KEYS = ["album", "tag", "genre"] as const;

type GroupKey = (typeof GROUP_KEYS)[number];

/** The location, album, tag and genre filters as they're named in the URL. */
export const FILTER_KEYS = [...LOCATION_KEYS, ...GROUP_KEYS] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/**
 * The filters every portfolio view shares, kept in the URL; each is left out when it isn't set.
 * Any number of countries, cities and places can be chosen: one is kept as text, so a link to one
 * place stays readable, and more as a list.
 */
export type PhotoFilters = Partial<
  Record<LocationKey, string | string[]> & Record<GroupKey, string>
>;

/** A location filter's values as a list, however many there are. */
function locationValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
}

/** The text in a URL value that's text or a list of text, leaving out anything else and anything empty. */
function textValues(value: unknown): string[] {
  const list: unknown[] = Array.isArray(value) ? value : [value];
  return list.filter((item): item is string => typeof item === "string" && item !== "");
}

/** The values as the URL keeps them: left out when there are none, text for one, else a list. */
function locationSearchValue(values: string[]): string | string[] | undefined {
  if (values.length > 1) return values;
  return values[0];
}

/** The filters in the URL's search, leaving out anything that isn't a filter or is empty. */
export function parseFilters(search: Record<string, unknown>): PhotoFilters {
  const locations = LOCATION_KEYS.flatMap((key) => {
    const value = locationSearchValue(textValues(search[key]));
    return value === undefined ? [] : [[key, value]];
  });
  const groups = GROUP_KEYS.flatMap((key) => {
    const value = search[key];
    return typeof value === "string" && value !== "" ? [[key, value]] : [];
  });
  return Object.fromEntries([...locations, ...groups]);
}

/** Whether any filter is set. */
export function hasFilters(filters: PhotoFilters): boolean {
  return Object.keys(filters).length > 0;
}

/** How many choices the filters make: each country, city and place counts, and the album, tag and genre. */
export function filterCount(filters: PhotoFilters): number {
  const locations = LOCATION_KEYS.flatMap((key) => locationValues(filters[key])).length;
  return locations + GROUP_KEYS.filter((key) => filters[key] !== undefined).length;
}

/** Whether the photo is in the album with the ID or one of its sub-albums. */
function inAlbum(photo: Photo, id: string): boolean {
  const ids = albumAndSubAlbums(id);
  return photo.albums.some((album) => ids.has(album));
}

/** How each filter matches a photo to one of its values. */
const MATCHES: Record<FilterKey, (photo: Photo, value: string) => boolean> = {
  country: (photo, value) => photo.country === value,
  state: (photo, value) => photo.state === value,
  city: (photo, value) => photo.city === value,
  place: (photo, value) => photo.placeIds.includes(value),
  album: inAlbum,
  tag: (photo, value) => photo.tags.includes(value),
  genre: (photo, value) => photo.genres.includes(value),
};

/** The chosen countries, cities and places, as pairs of a key and a value. */
function chosenLocations(filters: PhotoFilters): [LocationKey, string][] {
  return LOCATION_KEYS.flatMap((key) =>
    locationValues(filters[key]).map((value): [LocationKey, string] => [key, value]),
  );
}

/** Whether the photo was taken in any of the chosen locations, or none are chosen. */
function matchesLocations(photo: Photo, filters: PhotoFilters): boolean {
  const chosen = chosenLocations(filters);
  return chosen.length === 0 || chosen.some(([key, value]) => MATCHES[key](photo, value));
}

/** Whether the photo matches every filter that's set; it needs to match one of several locations. */
export function matchesFilters(photo: Photo, filters: PhotoFilters): boolean {
  return (
    matchesLocations(photo, filters) &&
    GROUP_KEYS.every((key) => {
      const value = filters[key];
      return value === undefined || MATCHES[key](photo, value);
    })
  );
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

/** The chosen locations as the Places filter's values, such as "city:Seoul". */
export function locationSelection(filters: PhotoFilters): string[] {
  return chosenLocations(filters).map(([key, value]) => `${key}:${value}`);
}

/** The location filters the Places filter's values set, such as "city:Seoul". */
export function locationFilters(selection: string[]): PhotoFilters {
  const pairs = selection.map((selected) => selected.split(/:(.*)/s, 2) as [LocationKey, string]);
  return Object.fromEntries(
    LOCATION_KEYS.flatMap((key) => {
      const value = locationSearchValue(pairs.filter(([k]) => k === key).map(([, v]) => v));
      return value === undefined ? [] : [[key, value]];
    }),
  );
}
