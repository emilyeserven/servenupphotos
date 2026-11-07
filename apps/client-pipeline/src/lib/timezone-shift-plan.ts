import type { TripLine } from "@/api/trip-lines";
import { type ComparePhoto, comparePhotoName } from "@/lib/compare-groups";
import { type CameraClock, DEFAULT_CLOCK, byCamera, resolveClock } from "@/lib/camera-clock";
import {
  type Clock,
  type ShiftSide,
  type ShiftZones,
  dayOf,
  minutesBetween,
  photoZone,
  shiftedTime,
} from "@/lib/timezone-shift";

/** The JSON field the fixed time is written to; the EXIF `createDate` is kept as it is. */
export const CUSTOM_DATE = "customCreateDate";

/** A photo that could have been taken on the day being fixed. */
export interface DayPhoto {
  photo: ComparePhoto;
  /** What to call it: its title, or else its file name. */
  name: string;
  /** Its smallest image, for the list. */
  imageUrl?: string;
  /** Its ID, which trip lines list photos by, when it has one. */
  id?: number;
  /** What the camera's clock read: the EXIF date, or else the custom one when the EXIF has none. */
  clockTime: string;
  /** The time the portfolio uses now: the custom date, or else the EXIF one. */
  currentTime: string;
}

/** A field's text, trimmed, or "" when it isn't text. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const EXIF_DATE = /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}/;

function isDate(value: string): boolean {
  return EXIF_DATE.test(value);
}

/** The first of the values that's an exiftool date, or "". */
function firstDate(...values: string[]): string {
  return values.find(isDate) ?? "";
}

/** The photo's smallest image in R2, or else the one the list read. */
function smallImage(photo: ComparePhoto): string | undefined {
  const images = (photo.data.images ?? {}) as Record<string, unknown>;
  const small = textOf(images.xsmall) || textOf(images.small);
  return small || photo.imageUrl;
}

/** The photo as one that could be on the day, or null when it has no date at all. */
function dayPhoto(photo: ComparePhoto): DayPhoto | null {
  const exif = textOf(photo.data.createDate);
  const custom = textOf(photo.data[CUSTOM_DATE]);
  const clockTime = firstDate(exif, custom);
  if (!clockTime) return null;
  const id = photo.data.id;
  return {
    photo,
    name: comparePhotoName(photo),
    imageUrl: smallImage(photo),
    id: typeof id === "number" ? id : undefined,
    clockTime,
    currentTime: firstDate(custom, exif),
  };
}

/** Whether the photo's clock time or the time used now falls on the day ("2016-12-23"). */
function isOnDay(photo: DayPhoto, day: string): boolean {
  return dayOf(photo.clockTime) === day || dayOf(photo.currentTime) === day;
}

/**
 * The photos whose camera clock or current time is on the day, in the order the camera took them.
 * A photo already fixed onto the next day still shows, so the fix can be changed.
 */
export function photosOnDay(photos: DayPhoto[], day: string): DayPhoto[] {
  return photos
    .filter((photo) => isOnDay(photo, day))
    .toSorted((a, b) => a.clockTime.localeCompare(b.clockTime));
}

/** Every photo with a date, as one that could be on the day being fixed. */
export function datedPhotos(photos: ComparePhoto[]): DayPhoto[] {
  return photos.map(dayPhoto).filter((photo): photo is DayPhoto => photo !== null);
}

/** What fixing one photo would do. */
export interface PlannedShift {
  day: DayPhoto;
  side: Exclude<ShiftSide, "skip">;
  /** The local time where it was taken, after the fix. */
  fixedTime: string;
  /** What `customCreateDate` becomes: null when the fixed time is the EXIF one, so none is needed. */
  value: string | null;
  /** How far the time used now moves, in minutes. */
  minutes: number;
}

/** What `customCreateDate` should hold for the fixed time: none when the EXIF date already says it. */
function customValue(day: DayPhoto, fixedTime: string): string | null {
  return textOf(day.photo.data.createDate) === fixedTime ? null : fixedTime;
}

/**
 * What fixing the photo would do, or null when it's left out, its camera's clock was right or isn't
 * worked out yet, or a timezone isn't chosen.
 */
function planOne(
  day: DayPhoto,
  side: ShiftSide,
  zones: ShiftZones,
  clock: Clock | null,
): PlannedShift | null {
  if (side === "skip" || !clock) return null;
  const fixedTime = shiftedTime(day.clockTime, photoZone(side, zones), clock);
  if (!fixedTime) return null;
  const minutes = minutesBetween(day.currentTime, fixedTime);
  return { day, side, fixedTime, value: customValue(day, fixedTime), minutes };
}

/**
 * What fixing each photo would do, for the ones on a side of the change, by camera, each with the
 * clock its camera kept (`clocks` by camera name; one not listed kept the start timezone).
 */
export function planShifts(
  photos: DayPhoto[],
  sides: Record<string, ShiftSide>,
  zones: ShiftZones,
  clocks: Record<string, CameraClock>,
): PlannedShift[] {
  const context = { zones, photos, sides };
  return byCamera(photos).flatMap(([camera, days]) => {
    const clock = resolveClock(clocks[camera] ?? DEFAULT_CLOCK, context);
    return days
      .map((day) => planOne(day, sides[day.photo.file.path] ?? "before", zones, clock))
      .filter((plan): plan is PlannedShift => plan !== null);
  });
}

/** Whether the fix moves the photo to another day. */
export function movesDay(plan: PlannedShift): boolean {
  return dayOf(plan.day.currentTime) !== dayOf(plan.fixedTime);
}

/** A hand-marked trip line the fix leaves out of date, and how. */
export interface TripLineEffect {
  day: string;
  /**
   * "leaves" when photos it goes through move off its day, "joins" when other photos move onto it,
   * and "order" when only the order of its photos changes.
   */
  kind: "leaves" | "joins" | "order";
}

/** The photo IDs on each day, in time order, for the times given. */
function idsByDay(entries: { id: number; time: string }[]): Map<string, number[]> {
  const byDay = new Map<string, number[]>();
  for (const { id, time } of entries.toSorted((a, b) => a.time.localeCompare(b.time))) {
    byDay.set(dayOf(time), [...(byDay.get(dayOf(time)) ?? []), id]);
  }
  return byDay;
}

/** Every photo with an ID, at its current time and at its time after the fix. */
function timesOf(photos: DayPhoto[], fixed: Map<string, string>) {
  const withId = photos.filter((photo) => photo.id !== undefined);
  const at = (time: (photo: DayPhoto) => string) =>
    withId.map((photo) => ({ id: photo.id as number, time: time(photo) }));
  return {
    now: idsByDay(at((photo) => photo.currentTime)),
    fixed: idsByDay(at((photo) => fixed.get(photo.photo.file.path) ?? photo.currentTime)),
  };
}

/** How the line's day changes: photos it goes through leave, others join, the order changes, or nothing. */
function lineEffect(line: TripLine, now: number[], fixed: number[]): TripLineEffect | null {
  const used = new Set(line.segments.flatMap((segment) => segment.photos));
  const kind = effectKind(used, now, fixed);
  return kind ? { day: line.day, kind } : null;
}

/** Which way the day's photos change for a line through the used ones; null when it isn't touched. */
function effectKind(
  used: Set<number>,
  now: number[],
  fixed: number[],
): TripLineEffect["kind"] | null {
  const onLine = (ids: number[]) => ids.filter((id) => used.has(id)).join();
  if (now.some((id) => used.has(id) && !fixed.includes(id))) return "leaves";
  if (fixed.some((id) => !now.includes(id))) return "joins";
  return onLine(now) === onLine(fixed) ? null : "order";
}

/** The days the changed photos are on now and after the fix. */
function touchedDays(plans: PlannedShift[]): string[] {
  const changed = plans.filter((plan) => plan.minutes !== 0);
  const days = changed.flatMap((plan) => [dayOf(plan.day.currentTime), dayOf(plan.fixedTime)]);
  return [...new Set(days)].toSorted();
}

/**
 * The hand-marked trip lines the fix leaves out of date: ones whose day gains or loses photos, and
 * ones whose photos would be taken in another order. `photos` is every dated photo, so the order
 * counts the ones the fix doesn't move too. Automatic lines are redrawn at every Commit.
 */
export function tripLineEffects(
  plans: PlannedShift[],
  photos: DayPhoto[],
  lines: Map<string, TripLine>,
): TripLineEffect[] {
  const times = timesOf(photos, new Map(plans.map((p) => [p.day.photo.file.path, p.fixedTime])));
  return touchedDays(plans)
    .map((day) => lines.get(day))
    .filter((line): line is TripLine => line !== undefined && !line.auto)
    .map((line) => lineEffect(line, times.now.get(line.day) ?? [], times.fixed.get(line.day) ?? []))
    .filter((effect): effect is TripLineEffect => effect !== null);
}
