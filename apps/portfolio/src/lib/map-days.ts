import { format } from "date-fns";
import type { LngLatBounds } from "maplibre-gl";
import type { PlacedPhoto } from "@/lib/map-photos";

/** The day a photo was taken, as the map's `day` filter writes it, such as 2026-05-16. */
function dayOf(photo: PlacedPhoto): string {
  return format(photo.takenAt, "yyyy-MM-dd");
}

/** Whether the text is a day as the `day` filter writes it. */
export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** A day the map can be narrowed to, with how many of the photos in view were taken on it. */
export interface MapDay {
  day: string;
  count: number;
}

/** How many of the photos were taken on each day. */
function countByDay(photos: PlacedPhoto[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    const day = dayOf(photo);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

/** The days the photos inside the bounds were taken on, newest first, with how many each. */
export function daysInView(photos: PlacedPhoto[], bounds: LngLatBounds | null): MapDay[] {
  if (!bounds) return [];
  const inView = photos.filter((photo) => bounds.contains([photo.longitude, photo.latitude]));
  return [...countByDay(inView)]
    .map(([day, count]) => ({ day, count }))
    .toSorted((a, b) => b.day.localeCompare(a.day));
}

/** The photos taken on the day, or all of them without one. */
export function photosOnDay(photos: PlacedPhoto[], day: string | undefined): PlacedPhoto[] {
  return day ? photos.filter((photo) => dayOf(photo) === day) : photos;
}
