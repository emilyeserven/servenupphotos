import type { Photo } from "@portfolio/lib/photos";

/**
 * Minutes since midnight when the photo was taken, by the clock where it was taken, since its
 * capture time has no time zone and is read as it was written.
 */
export function minuteOfDay(photo: Photo): number {
  return photo.takenAt.getHours() * 60 + photo.takenAt.getMinutes();
}
