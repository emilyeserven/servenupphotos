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
 * One coordinate in degrees, minutes and seconds with its hemisphere, such as `37°34′12″N`,
 * `37° 34' 12.5" N` or exiftool's `37 deg 34' 12.50" N`; the minutes and seconds are optional.
 */
const DMS_COORDINATE =
  /(\d+(?:\.\d+)?)\s*(?:°|º|deg\b)\s*(?:(\d+(?:\.\d+)?)\s*['′’]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:["″”]|''|′′)\s*)?([NSEW])/gi;

/** A coordinate's degrees, minutes, seconds and hemisphere as decimal degrees, negative to the south and west. */
function dmsDegrees(match: RegExpMatchArray): number {
  const [deg, min, sec] = match.slice(1, 4).map((part) => Number(part ?? 0)) as [
    number,
    number,
    number,
  ];
  const sign = /[SW]/i.test(match[4] ?? "") ? -1 : 1;
  return Math.round(sign * (deg + min / 60 + sec / 3600) * 1e6) / 1e6;
}

/** Whether the coordinate is a latitude: north or south. */
function isLatitude(match: RegExpMatchArray): boolean {
  return /[NS]/i.test(match[4] ?? "");
}

/** Whether text is only the coordinates, with spaces, commas or semicolons between them. */
function onlyCoordinates(text: string): boolean {
  return /^[\s,;]*$/.test(text.replace(DMS_COORDINATE, ""));
}

/** The latitude and the longitude written in text, when it has exactly one of each. */
function latLngMatches(text: string): [RegExpMatchArray, RegExpMatchArray] | null {
  const matches = [...text.matchAll(DMS_COORDINATE)];
  const lat = matches.find(isLatitude);
  const lng = matches.find((match) => !isLatitude(match));
  return matches.length === 2 && lat && lng ? [lat, lng] : null;
}

/**
 * The GPS position written in degrees, minutes and seconds, such as `37°34′12″N 126°59′56″E` (how
 * Wikipedia writes one), latitude and longitude in either order; null when it isn't written that way.
 */
function dmsPosition(text: string): Coordinates | null {
  const pair = onlyCoordinates(text) ? latLngMatches(text) : null;
  if (!pair) return null;
  const parts = pair.map(dmsDegrees);
  return isPosition(parts) ? { latitude: parts[0], longitude: parts[1] } : null;
}

/**
 * text with a position written in degrees, minutes and seconds rewritten as "latitude, longitude" in
 * decimal degrees, which is how GPS positions are saved; any other text as it is.
 */
export function decimalGps(text: string): string {
  const position = dmsPosition(text);
  return position ? gpsText(position) : text;
}

/**
 * The GPS position written as "latitude, longitude" in decimal degrees, such as "37.5796, 126.977"
 * (how Google Maps copies one), or in degrees, minutes and seconds, such as `37°34′12″N
 * 126°59′56″E`: no coordinates for empty text, or null when it can't be read.
 */
export function parseGps(text: string): Coordinates | null {
  if (!text.trim()) return {};
  const dms = dmsPosition(text);
  if (dms) return dms;
  const parts = text.split(",").map(degrees);
  return isPosition(parts) ? { latitude: parts[0], longitude: parts[1] } : null;
}

/** Whether both parts of the position are there. */
function hasPosition(position: Coordinates): position is Required<Coordinates> {
  return position.latitude !== undefined && position.longitude !== undefined;
}

/**
 * A GPS position written as "latitude, longitude", such as a photo's custom one, or null when none is
 * written or it can't be read.
 */
export function writtenPosition(text: string | undefined): Required<Coordinates> | null {
  const parsed = parseGps(text ?? "") ?? {};
  return hasPosition(parsed) ? parsed : null;
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

/** Whether the photo has its own GPS position: in its EXIF, or a custom one written on the Photo page. */
function hasOwnPhotoGps(photo: CombinedPhoto): boolean {
  const custom = typeof photo.customGpsPosition === "string" ? photo.customGpsPosition : "";
  return Boolean(writtenPosition(custom)) || hasText(photo.gpsPosition);
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** Whether the photo can go on the portfolio's map: by its own GPS position, or one of its places' (or a place above them). */
function isOnMap(photo: CombinedPhoto, byId: Map<string, Place>, places: Place[]): boolean {
  if (hasOwnPhotoGps(photo)) return true;
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
