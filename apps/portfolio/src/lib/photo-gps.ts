import { type Place, placeById } from "@portfolio/lib/localize";
import type { PhotoEntry } from "@portfolio/lib/photos";

/** A GPS position in decimal degrees; both parts null when there is none. */
export interface Position {
  latitude: number | null;
  longitude: number | null;
}

const NO_POSITION: Position = { latitude: null, longitude: null };

/**
 * One coordinate of exiftool's `37 deg 31' 21.06" N, 126 deg 58' 46.24" E`, in decimal degrees.
 * `hemispheres` lists the positive hemisphere first: "NS" for latitude, "EW" for longitude.
 */
function exifCoordinate(value: string, hemispheres: "NS" | "EW"): number | null {
  const number = String.raw`(\d+(?:\.\d+)?)`;
  const match = value.match(new RegExp(`${number} deg ${number}' ${number}" ([${hemispheres}])`));
  if (!match) return null;
  const [, deg, min, sec, hemisphere] = match;
  const degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return hemisphere === hemispheres[0] ? degrees : -degrees;
}

/** One coordinate in decimal degrees, as a custom GPS position writes it, such as `-73.9634`. */
function decimalCoordinate(value: string): number | null {
  return /^\s*-?\d+(\.\d+)?\s*$/.test(value) ? Number(value) : null;
}

/** One coordinate, written in decimal degrees or as exiftool writes it. */
function parseCoordinate(value: string, hemispheres: "NS" | "EW"): number | null {
  return decimalCoordinate(value) ?? exifCoordinate(value, hemispheres);
}

/**
 * A GPS position as exiftool writes it, or as a custom one is written on the Photo page
 * ("40.7795, -73.9634"); both parts null when it can't be read.
 */
function parseGpsPosition(value: string | null): Position {
  const [lat = "", lng = ""] = value?.split(",") ?? [];
  const latitude = parseCoordinate(lat, "NS");
  const longitude = parseCoordinate(lng, "EW");
  return latitude === null || longitude === null ? NO_POSITION : { latitude, longitude };
}

/** A GPS position from a place, and whether it's exactly where photos given the place were taken. */
type PlacePosition = Position & { exact: boolean };

const NO_PLACE_POSITION: PlacePosition = { ...NO_POSITION, exact: false };

/**
 * The place's own GPS position, exact when the place is marked as an exact location, or else the
 * nearest place above it that has one, which is never exact: the photo is only somewhere in it.
 */
function placePosition(id: string | undefined, passed = new Set<string>()): PlacePosition {
  const place = placeById(id);
  if (!place || passed.has(place.id)) return NO_PLACE_POSITION;
  const own = ownPosition(place);
  if (own) return { ...own, exact: place.exactLocation === true };
  return { ...placePosition(place.parent, passed.add(place.id)), exact: false };
}

/** The GPS position set on the place itself, if both parts are. */
function ownPosition({ latitude, longitude }: Place): Position | undefined {
  return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude };
}

/** The photo's own GPS position: the custom one written on the Photo page, or else its EXIF one. */
export function photoGps(photo: PhotoEntry): Position {
  const written = parseGpsPosition(photo.customGpsPosition ?? null);
  return written.latitude === null ? parseGpsPosition(photo.gpsPosition) : written;
}

/**
 * Where the photo goes on the map: its custom or EXIF GPS position, or else the first of its places (or a
 * place it's in) with a GPS position set on the Places page. A place's position is approximate
 * unless that place is marked as an exact location.
 */
export function photoPosition(photo: PhotoEntry): Position & { approximatePosition: boolean } {
  const exif = photoGps(photo);
  if (exif.latitude !== null) return { ...exif, approximatePosition: false };
  const found = (photo.places ?? []).map(({ id }) => placePosition(id));
  const position = found.find(({ latitude }) => latitude !== null);
  if (!position) return { ...NO_POSITION, approximatePosition: false };
  const { exact, ...at } = position;
  return { ...at, approximatePosition: !exact };
}

/** One coordinate as degrees, minutes and seconds, such as 37°31′21″ N. */
function dmsText(degrees: number, hemispheres: "NS" | "EW"): string {
  const seconds = Math.round(Math.abs(degrees) * 3600);
  const deg = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const hemisphere = degrees < 0 ? hemispheres[1] : hemispheres[0];
  return `${deg}°${min}′${seconds % 60}″ ${hemisphere}`;
}

/** The GPS position as a photographer writes it, such as 37°31′21″ N, 126°58′46″ E. */
export function gpsText({ latitude, longitude }: Position): string | null {
  if (latitude === null || longitude === null) return null;
  return `${dmsText(latitude, "NS")}, ${dmsText(longitude, "EW")}`;
}
