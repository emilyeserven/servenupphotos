import type { ColorOrder } from "@/lib/color-sort";
import { distanceKm, type Point } from "@/lib/distance";
import type { LocationOption } from "@/lib/filter-options";
import { placeById } from "@/lib/localize";
import { filterPhotos, LOCATION_KEYS, locationFilters } from "@/lib/photo-filters";
import type { Photo } from "@/lib/photos";

/** Where **Distance** measures from when the URL doesn't say: Stamford, CT. */
export const DEFAULT_NEAR: Point = { latitude: 41.0534, longitude: -73.5387 };

/** The default spot's name, on the Grid's **From** button. */
export const DEFAULT_NEAR_LABEL = "Stamford, CT";

/** A photo the map can place, with the spot it's placed at. */
type Positioned<T extends Photo> = T & Point;

/** Whether the photo has a GPS position, its own or one of its places'. */
function hasPosition<T extends Photo>(photo: T): photo is Positioned<T> {
  return photo.latitude !== null && photo.longitude !== null;
}

/**
 * "latitude,longitude" in decimal degrees as a spot, such as "41.0534,-73.5387"; undefined when
 * it isn't one or is off the globe.
 */
export function parsePoint(text: string): Point | undefined {
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

/** A spot as the URL keeps it, to 4 decimal places (about 10 m), such as "41.0534,-73.5387". */
export function pointText({ latitude, longitude }: Point): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

/** Whether the text is a Places filter value, such as "city:Stamford" or "place:osaka-castle-park". */
function isLocationValue(text: string): boolean {
  const [key, value] = text.split(/:(.*)/s, 2);
  return LOCATION_KEYS.includes(key as (typeof LOCATION_KEYS)[number]) && Boolean(value);
}

/**
 * The `?near=` to keep: a spot ("41.0534,-73.5387") or a Places filter value ("city:Stamford"),
 * and nothing for anything else, which measures from Stamford, CT.
 */
export function parseNear(near: unknown): { near?: string } {
  if (typeof near !== "string") return {};
  return parsePoint(near) || isLocationValue(near) ? { near } : {};
}

/** The middle of the photos' spots, by their average latitude and longitude. */
function middleOf(spots: Point[]): Point | undefined {
  if (spots.length === 0) return undefined;
  const sum = (pick: (spot: Point) => number) => spots.reduce((total, s) => total + pick(s), 0);
  return {
    latitude: sum((s) => s.latitude) / spots.length,
    longitude: sum((s) => s.longitude) / spots.length,
  };
}

/** A place's own GPS position, set on the Places page, for `place:<id>`. */
function placePoint(value: string): Point | undefined {
  if (!value.startsWith("place:")) return undefined;
  const place = placeById(value.slice("place:".length));
  if (place?.latitude === undefined || place.longitude === undefined) return undefined;
  return { latitude: place.latitude, longitude: place.longitude };
}

/**
 * Where **Distance** measures from: the URL's spot, or a place's own GPS position, or else the
 * middle of the photos taken in the chosen country, region, city or place, or Stamford, CT when
 * the URL doesn't say or none of those photos have a position.
 */
export function nearPoint(near: string | undefined, photos: Photo[]): Point {
  if (!near) return DEFAULT_NEAR;
  const point = parsePoint(near) ?? placePoint(near);
  if (point) return point;
  const inside = filterPhotos(photos, locationFilters([near])).filter(hasPosition);
  return middleOf(inside) ?? DEFAULT_NEAR;
}

/**
 * The photos, given newest first, by how far from `from` the map places them, nearest first (or
 * farthest, descending), photos at the same distance newest first, and the photos the map can't
 * place after the rest, newest first.
 */
export function byDistance<T extends Photo>(newestFirst: T[], order: ColorOrder, from: Point): T[] {
  const sign = order === "desc" ? -1 : 1;
  const placed = newestFirst
    .filter(hasPosition)
    .map((photo) => ({ photo, km: distanceKm(from, photo) }))
    .toSorted((a, b) => sign * (a.km - b.km))
    .map(({ photo }) => photo);
  return [...placed, ...newestFirst.filter((photo) => !hasPosition(photo))];
}

/** The place in the Places tree with the value, such as "city:Stamford", searching every level. */
function findOption(options: LocationOption[], near: string): LocationOption | undefined {
  for (const option of options) {
    if (`${option.key}:${option.value}` === near) return option;
    const inside = findOption(option.children, near);
    if (inside) return inside;
  }
  return undefined;
}

/**
 * The name of where Distance measures from, for the **From** button: Stamford, CT, a spot to 2
 * places ("41.05, -73.54"), or the chosen place's English name from the Places tree.
 */
export function nearLabel(near: string | undefined, options: LocationOption[]): string {
  if (!near) return DEFAULT_NEAR_LABEL;
  const point = parsePoint(near);
  if (point) return `${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`;
  return findOption(options, near)?.label.english ?? near.slice(near.indexOf(":") + 1);
}

/** A distance in words: meters under 1 km ("350 m"), one decimal under 10 km ("4.2 km"), else whole km ("1,234 km"). */
export function distanceText(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

/** How far from `from` the map places the photo, in words, or undefined when it can't place it. */
export function photoDistanceText(photo: Photo, from: Point): string | undefined {
  return hasPosition(photo) ? distanceText(distanceKm(from, photo)) : undefined;
}
