import { albumAndSubAlbums, tagAndSubTags } from "@portfolio/lib/groups";
import type { Photo } from "@portfolio/lib/photos";
import {
  matchesWhen,
  parseWhen,
  WHEN_KEYS,
  type WhenFilters,
  type WhenKey,
  whenCount,
} from "@portfolio/lib/when-filters";

/** The location filter's keys: countries, cities (by their English names) and places (by their IDs). */
export const LOCATION_KEYS = ["country", "state", "city", "place"] as const;

export type LocationKey = (typeof LOCATION_KEYS)[number];

/** The album, tag and genre filters' keys; an album also matches the photos in its sub-albums. */
const GROUP_KEYS = ["album", "tag", "genre"] as const;

type GroupKey = (typeof GROUP_KEYS)[number];

/** The location, album, tag and genre filters' keys. */
export type FilterKey = LocationKey | GroupKey;

/**
 * Every filter as it's named in the URL: the location, album, tag and genre filters, the "when"
 * filters (months, days of the week, hours and a date range, see `when-filters.ts`), and `ids`, the
 * photos chosen one by one, as the map's **View in grid** sets when no place covers just its photos.
 */
export const FILTER_KEYS = [...LOCATION_KEYS, ...GROUP_KEYS, ...WHEN_KEYS, "ids"] as const;

/**
 * The filters every portfolio view shares, kept in the URL; each is left out when it isn't set.
 * Any number of countries, cities and places can be chosen: one is kept as text, so a link to one
 * place stays readable, and more as a list.
 */
export type PhotoFilters = Partial<
  Record<LocationKey, string | string[]> & Record<GroupKey, string> & { ids: number[] }
> &
  WhenFilters;

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
  return {
    ...Object.fromEntries([...locations, ...groups]),
    ...parseWhen(search),
    ...idsOf(search.ids),
  };
}

/** The photos chosen one by one in the URL, left out when there are none. */
function idsOf(value: unknown): PhotoFilters {
  const ids = (Array.isArray(value) ? value : [value]).filter(Number.isInteger);
  return ids.length > 0 ? { ids } : {};
}

/** Whether any filter is set. */
export function hasFilters(filters: PhotoFilters): boolean {
  return Object.keys(filters).length > 0;
}

/**
 * How many choices the filters make: each country, city and place counts, and the album, tag,
 * genre and photos chosen one by one.
 */
export function filterCount(filters: PhotoFilters): number {
  const locations = LOCATION_KEYS.flatMap((key) => locationValues(filters[key])).length;
  const groups = GROUP_KEYS.filter((key) => filters[key] !== undefined).length;
  return locations + groups + whenCount(filters) + (filters.ids ? 1 : 0);
}

/** Whether the photo is in the album with the ID or one of its sub-albums. */
function inAlbum(photo: Photo, id: string): boolean {
  const ids = albumAndSubAlbums(id);
  return photo.albums.some((album) => ids.has(album));
}

/** Whether the photo has the tag or one of the tags under it. */
function hasTag(photo: Photo, id: string): boolean {
  const ids = tagAndSubTags(id);
  return photo.tags.some((tag) => ids.has(tag));
}

/** The state filter's value for the photos with no state, province or prefecture: `?state=none`. */
export const NO_STATE = "none";

/** Whether the photo is in the state, or has none when the value is `NO_STATE`. */
function inState(photo: Photo, value: string): boolean {
  return value === NO_STATE ? photo.state === null : photo.state === value;
}

/** How each filter matches a photo to one of its values. */
const MATCHES: Record<FilterKey, (photo: Photo, value: string) => boolean> = {
  country: (photo, value) => photo.country === value,
  state: inState,
  city: (photo, value) => photo.city === value,
  place: (photo, value) => photo.placeIds.includes(value),
  album: inAlbum,
  tag: hasTag,
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

/** Whether the photo is one of the photos chosen one by one, or none are chosen. */
function matchesIds(photo: Photo, ids: number[] | undefined): boolean {
  return !ids || ids.includes(photo.id);
}

/** Whether the photo matches every filter that's set; it needs to match one of several locations. */
export function matchesFilters(photo: Photo, filters: PhotoFilters): boolean {
  return (
    matchesIds(photo, filters.ids) &&
    matchesLocations(photo, filters) &&
    matchesWhen(photo, filters) &&
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
export function withoutFilters(
  filters: PhotoFilters,
  keys: readonly (FilterKey | WhenKey | "ids")[],
): PhotoFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([key]) => !keys.includes(key as FilterKey | WhenKey)),
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
