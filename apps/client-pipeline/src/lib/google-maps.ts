/** A GPS position in decimal degrees: north and east positive. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** One coordinate as exiftool writes it, such as `40 deg 46' 46.20" N`. */
const EXIF_COORDINATE = /(\d+(?:\.\d+)?) deg (\d+(?:\.\d+)?)' (\d+(?:\.\d+)?)" ([NSEW])/g;

/** A coordinate's degrees, minutes, seconds and hemisphere as decimal degrees, negative to the south and west. */
function decimalDegrees([, deg, min, sec, hemisphere]: RegExpMatchArray): number {
  const value = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return hemisphere === "S" || hemisphere === "W" ? -value : value;
}

/**
 * The GPS position in a photo's EXIF, as exiftool writes it (`40 deg 46' 46.20" N, 73 deg 57'
 * 20.20" W`), in decimal degrees; null when it can't be read.
 */
export function parseExifGps(text: string): LatLng | null {
  const [lat, lng] = [...text.matchAll(EXIF_COORDINATE)];
  if (!lat || !lng) return null;
  return { latitude: decimalDegrees(lat), longitude: decimalDegrees(lng) };
}

/**
 * Google Maps searching for the position, which drops a pin on it. See
 * https://developers.google.com/maps/documentation/urls/get-started#search-action
 */
export function googleMapsUrl({ latitude, longitude }: LatLng): string {
  const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
