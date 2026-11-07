import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { TripLegEnd } from "@/api/trips";
import type { TripDay, TripPhoto } from "@/lib/trip-days";

/** Every day from start to end, both included, such as "2026-09-20"; none when they're backwards. */
export function datesBetween(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map((d) =>
    format(d, "yyyy-MM-dd"),
  );
}

/**
 * The photo a leg's end uses when it has no spot of its own: the day's last photo with an exact
 * spot where it leaves, or its first where it arrives; undefined when the day has none.
 */
export function endPhoto(
  end: TripLegEnd,
  days: Map<string, TripDay>,
  last: boolean,
): TripPhoto | undefined {
  const photos = days.get(end.day)?.photos ?? [];
  return last ? photos.at(-1) : photos[0];
}

type Position = { latitude: number; longitude: number };

/** Where a leg's end is: its spot, or else its photo; undefined when it has neither. */
export function endPosition(end: TripLegEnd, photo: TripPhoto | undefined): Position | undefined {
  return end.spot ?? photo;
}

/** How far apart two spots are along the Earth's surface, in km (the haversine formula). */
export function distanceKm(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "latitude, longitude" as a position, such as "33.6064, 130.4017"; undefined when it isn't one. */
export function parsePosition(text: string): Position | undefined {
  const parts = text.split(",").map((p) => Number(p.trim()));
  const [latitude, longitude] = parts;
  if (parts.length !== 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude))
    return undefined;
  return { latitude: latitude!, longitude: longitude! };
}
