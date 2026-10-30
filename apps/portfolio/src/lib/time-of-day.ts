import type { Photo } from "@portfolio/lib/photos";

/**
 * Minutes since midnight when the photo was taken, by the clock where it was taken, since its
 * capture time has no time zone and is read as it was written.
 */
export function minuteOfDay(photo: Photo): number {
  return photo.takenAt.getHours() * 60 + photo.takenAt.getMinutes();
}

/** The hours of the day the photos were taken in, each once, earliest first, such as ["6", "7", "18"]. */
export function photoHours(list: Photo[]): string[] {
  const hours = new Set(list.map((photo) => photo.takenAt.getHours()));
  return [...hours].toSorted((a, b) => a - b).map(String);
}

/** An hour of the day on a 12-hour clock, such as "6 AM", or "12 AM" for midnight, either end of the day. */
function clockText(hour: number): string {
  const half = hour % 24 < 12 ? "AM" : "PM";
  return `${hour % 12 || 12} ${half}`;
}

/** The start of an hour the URL writes, such as "6 AM" for "6". */
export function hourStart(hour: string): string {
  return clockText(Number(hour));
}

/** The end of an hour the URL writes, which is when the next one starts, such as "7 PM" for "18". */
export function hourEnd(hour: string): string {
  return clockText(Number(hour) + 1);
}

/**
 * Whether the photo was taken within a range of hours the URL writes, such as ["6", "18"]: from
 * the start of the first hour to the end of the last, so 6 AM to 7 PM.
 */
export function inHours(photo: Photo, [low, high]: [string, string]): boolean {
  const hour = photo.takenAt.getHours();
  return hour >= Number(low) && hour <= Number(high);
}
