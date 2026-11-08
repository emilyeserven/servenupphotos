import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { TripLeg, TripLegEnd } from "@/api/trips";
import type { TripDay, TripPhoto } from "@/lib/trip-days";

/** Every day from start to end, both included, such as "2026-09-20"; none when they're backwards. */
export function datesBetween(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map((d) =>
    format(d, "yyyy-MM-dd"),
  );
}

/**
 * The photo a leg's end uses when it has no spot of its own: the one it names, or else the day's
 * last photo with an exact spot where it leaves, or its first where it arrives; undefined when the
 * day has none.
 */
export function endPhoto(
  end: TripLegEnd,
  days: Map<string, TripDay>,
  last: boolean,
): TripPhoto | undefined {
  const photos = dayPhotos(days, end.day);
  return namedPhoto(end, photos) ?? edgePhoto(photos, last);
}

/** The day's photos with an exact spot, in the order taken; none when it has none. */
export function dayPhotos(days: Map<string, TripDay>, day: string): TripPhoto[] {
  return days.get(day)?.photos ?? [];
}

/** The last photo, or else the first; undefined with none. */
function edgePhoto(photos: TripPhoto[], last: boolean): TripPhoto | undefined {
  return last ? photos.at(-1) : photos[0];
}

/** The photo the end names, when it's one of the day's; undefined otherwise. */
function namedPhoto(end: TripLegEnd, photos: TripPhoto[]): TripPhoto | undefined {
  return photos.find((p) => p.id === end.photo);
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

/** A time after every photo's, for an end at the close of its day. */
const DAY_END = "~";

/**
 * When a leg's end happens, for sorting: its day, then the time its photo was taken. An end at a
 * spot with no photo is taken as the day's last moment where it leaves and its first where it
 * arrives, as the day's last and first photos are when no photo is picked.
 */
function endTime(end: TripLegEnd, days: Map<string, TripDay>, last: boolean): string {
  return `${end.day} ${end.spot ? spotTime(last) : photoTime(endPhoto(end, days, last))}`;
}

/** When an end at a spot happens on its day: its close where it leaves, its start where it arrives. */
function spotTime(last: boolean): string {
  return last ? DAY_END : "";
}

/** When the photo was taken, for sorting; nothing without one. */
function photoTime(photo: TripPhoto | undefined): string {
  return photo?.taken ?? "";
}

/** When the leg leaves and arrives, for sorting. */
function legTimes(leg: TripLeg, days: Map<string, TripDay>): [string, string] {
  return [endTime(leg.from, days, true), endTime(leg.to, days, false)];
}

/**
 * The legs in the order they happen in the Trip: by the day and time each leaves, then arrives.
 * Legs that can't be told apart keep their order.
 */
export function legsInOrder(legs: TripLeg[], days: Map<string, TripDay>): TripLeg[] {
  const times = new Map(legs.map((leg) => [leg, legTimes(leg, days)]));
  return legs.toSorted((a, b) => {
    const [aFrom, aTo] = times.get(a)!;
    const [bFrom, bTo] = times.get(b)!;
    return aFrom.localeCompare(bFrom) || aTo.localeCompare(bTo);
  });
}
