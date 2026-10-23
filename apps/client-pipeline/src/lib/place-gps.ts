import { type Place, savedPlaces } from "@/api/places";
import type { CombinedPhoto } from "@/lib/group-photos";
import { placePhotoCounts } from "@/lib/place-seeds";
import { placeChain } from "@/lib/place-tree";

/** A place's GPS position, or neither part when it has none. */
type Coordinates = Pick<Place, "latitude" | "longitude">;

/** The text as a number of degrees, or NaN when it's empty or not a number. */
function degrees(text: string): number {
  return text.trim() ? Number(text) : NaN;
}

/** Whether the number is a coordinate up to limit degrees either way. */
function within(value: number, limit: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= limit;
}

/**
 * The GPS position written as "latitude, longitude" in decimal degrees, such as "37.5796, 126.977"
 * (how Google Maps copies one): no coordinates for empty text, or null when it can't be read.
 */
export function parseGps(text: string): Coordinates | null {
  if (!text.trim()) return {};
  const parts = text.split(",").map(degrees);
  return isPosition(parts) ? { latitude: parts[0], longitude: parts[1] } : null;
}

/** Whether the numbers are a latitude and a longitude on the globe. */
function isPosition(parts: number[]): parts is [number, number] {
  const [latitude = NaN, longitude = NaN] = parts;
  return parts.length === 2 && within(latitude, 90) && within(longitude, 180);
}

/** The place's GPS position as the form writes it, or "" when it has none. */
export function gpsText(place: Coordinates): string {
  const { latitude, longitude } = place;
  return latitude === undefined || longitude === undefined ? "" : `${latitude}, ${longitude}`;
}

/** Whether the place has a GPS position set on it. */
function hasOwnGps(place: Place): boolean {
  return place.latitude !== undefined && place.longitude !== undefined;
}

/** The place, or else the nearest place above it, that has a GPS position; undefined when none does. */
export function gpsSource(place: Place, places: Place[]): Place | undefined {
  return placeChain(place, places).chain.find(hasOwnGps);
}

/** Whether the photo's EXIF has a GPS position. */
function hasExifGps(photo: CombinedPhoto): boolean {
  return typeof photo.gpsPosition === "string" && photo.gpsPosition.trim() !== "";
}

/** Whether the photo can go on the portfolio's map: by its EXIF, or one of its places' (or a place above them). */
function isOnMap(photo: CombinedPhoto, byId: Map<string, Place>, places: Place[]): boolean {
  if (hasExifGps(photo)) return true;
  return savedPlaces(photo.places).some(({ id }) => {
    const place = byId.get(id);
    return place !== undefined && gpsSource(place, places) !== undefined;
  });
}

/**
 * How many photos list each place, by ID, among the photos that can't go on the map: no EXIF GPS
 * position, and none from their places. Giving one of those places a GPS position puts them there.
 */
export function unmappedPlacePhotos(photos: CombinedPhoto[], places: Place[]): Map<string, number> {
  const byId = new Map(places.map((place) => [place.id, place]));
  const unmapped = photos.filter((photo) => !isOnMap(photo, byId, places));
  return placePhotoCounts(unmapped);
}

/** One of exiftool's coordinates, such as `37 deg 34' 37.30" N`, as decimal degrees in text. */
function decimalDegrees([, deg, min, sec, hemisphere]: RegExpMatchArray): string {
  const value = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  const signed = hemisphere === "S" || hemisphere === "W" ? -value : value;
  return signed.toFixed(6).replace(/\.?0+$/, "");
}

/**
 * The photo's EXIF GPS position, exiftool's `37 deg 34' 37.30" N, 126 deg 58' 36.88" E`, written
 * the way the place form reads one ("37.577028, 126.976911"); "" when it can't be read.
 */
export function exifGpsText(exif: string | null): string {
  const coordinate = /(\d+(?:\.\d+)?) deg (\d+(?:\.\d+)?)' (\d+(?:\.\d+)?)" ([NSEW])/g;
  const parts = [...(exif ?? "").matchAll(coordinate)].map(decimalDegrees);
  return parts.length === 2 ? parts.join(", ") : "";
}
