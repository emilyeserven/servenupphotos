import type { Place } from "@/api/places";

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
