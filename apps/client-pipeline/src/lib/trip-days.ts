import type { Place } from "@/api/places";
import { savedPlaces } from "@/api/places";
import type { CombinedPhoto } from "@/lib/group-photos";
import { writtenPosition } from "@/lib/place-gps";

/** A photo a trip line can go through: one with an ID, a date and an exact spot. */
export interface TripPhoto {
  id: number;
  photo: CombinedPhoto;
  /** The day it was taken, such as "2026-09-23", and the time, such as "09:20". */
  day: string;
  time: string;
  /** When it was taken, as exiftool writes it, for sorting. */
  taken: string;
  latitude: number;
  longitude: number;
}

/** A day a trip line can be marked for: two or more photos at two or more spots. */
export interface TripDay {
  day: string;
  /** Its photos with an exact spot, in the order they were taken. */
  photos: TripPhoto[];
  /** How many different spots they're at. */
  spots: number;
}

type Position = { latitude: number; longitude: number };

/** A field's text, trimmed, or "" when it isn't text. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** When the photo was taken: its custom date, or else its EXIF one, as exiftool writes it. */
function takenOf(photo: CombinedPhoto): string | undefined {
  const date = textOf(photo.customCreateDate) || textOf(photo.createDate);
  return /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}/.test(date) ? date : undefined;
}

/** The photo's own GPS position: a custom one written on the Photo page, or else its EXIF one. */
function ownPosition(photo: CombinedPhoto): Position | null {
  return (
    writtenPosition(textOf(photo.customGpsPosition)) ?? writtenPosition(textOf(photo.gpsPosition))
  );
}

/** Whether the place is marked as an exact location and has a GPS position. */
function isExact(place: Place): place is Place & Position {
  return (
    place.exactLocation === true && place.latitude !== undefined && place.longitude !== undefined
  );
}

/** The GPS position of each place marked as an exact location, by ID. */
function exactPlaces(places: Place[]): Map<string, Position> {
  const exact = places.filter(isExact);
  return new Map(exact.map(({ id, latitude, longitude }) => [id, { latitude, longitude }]));
}

/** The photo's exact spot: its own GPS position, or else its first place marked as an exact location. */
function spotOf(photo: CombinedPhoto, exact: Map<string, Position>): Position | null {
  const own = ownPosition(photo);
  if (own) return own;
  const found = savedPlaces(photo.places).find(({ id }) => exact.has(id));
  return found ? (exact.get(found.id) ?? null) : null;
}

/** The photo as a TripPhoto, or undefined when it has no ID, date or exact spot. */
function tripPhoto(photo: CombinedPhoto, exact: Map<string, Position>): TripPhoto | undefined {
  const taken = takenOf(photo);
  const spot = spotOf(photo, exact);
  if (typeof photo.id !== "number" || !taken || !spot) return undefined;
  const day = taken.slice(0, 10).replaceAll(":", "-");
  return { id: photo.id, photo, day, time: taken.slice(11, 16), taken, ...spot };
}

/** How many different spots the photos are at, to about 10 metres. */
function spotCount(photos: TripPhoto[]): number {
  return new Set(photos.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`)).size;
}

/** The photos by the day they were taken, each day's in the order they were taken. */
function byDay(photos: TripPhoto[]): Map<string, TripPhoto[]> {
  const days = new Map<string, TripPhoto[]>();
  const sorted = photos.toSorted((a, b) => a.taken.localeCompare(b.taken) || a.id - b.id);
  for (const p of sorted) days.set(p.day, [...(days.get(p.day) ?? []), p]);
  return days;
}

/** Every day a trip line can be marked for, newest first. */
export function tripDays(photos: CombinedPhoto[], places: Place[]): TripDay[] {
  const exact = exactPlaces(places);
  const usable = photos.flatMap((p) => tripPhoto(p, exact) ?? []);
  return [...byDay(usable)]
    .map(([day, dayPhotos]) => ({ day, photos: dayPhotos, spots: spotCount(dayPhotos) }))
    .filter((d) => d.photos.length >= 2 && d.spots >= 2)
    .toSorted((a, b) => b.day.localeCompare(a.day));
}
