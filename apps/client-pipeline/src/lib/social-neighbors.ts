import type { SocialPhoto } from "@/api/publish";
import { CREATE_DATE } from "@/lib/photo-fields";
import { customOr } from "@/lib/social-focus";
import { type Unsaved, currentData, dateOf } from "@/lib/social-schedule";

/** How many photos taken before the last scheduled one the picker suggests. */
const BEFORE_COUNT = 3;

/** How many photos taken after the last scheduled one the picker suggests. */
const AFTER_COUNT = 5;

/** A photo taken just before or after the last scheduled one. */
export interface Neighbor {
  photo: SocialPhoto;
  /** How many places before (negative) or after (positive) the last scheduled photo it is. */
  offset: number;
}

/** The photos around the last scheduled photo before a day, in the order they were taken. */
export interface Neighbors {
  /** The photo on the latest calendar day before the day being picked for. */
  anchor: SocialPhoto;
  /** The day anchor is on the calendar. */
  anchorDay: string;
  /** Up to 3 photos taken before anchor and 5 after, in the order they were taken. */
  photos: Neighbor[];
}

/**
 * When the photo was taken, as "YYYY-MM-DD HH:MM:SS" (the time is left blank when unknown) from its
 * custom or EXIF date, so taken times sort as text; "" when it has no date.
 */
export function takenAt(data: Record<string, unknown>): string {
  const match = customOr(data, CREATE_DATE).match(
    /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) return "";
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The photo's taken time, with its change waiting for Commit or local edit made over it. */
function takenWithChange(photo: SocialPhoto, changed: Map<string, unknown>): string {
  const data = currentData(photo, changed);
  return isObject(data) ? takenAt(data) : "";
}

/** The photo on the latest calendar day before day, and that day; null when none is before it. */
function lastScheduledBefore(photos: SocialPhoto[], unsaved: Unsaved, day: string) {
  let last: { anchor: SocialPhoto; anchorDay: string } | null = null;
  for (const photo of photos) {
    const date = dateOf(unsaved, photo);
    if (date && date < day && (!last || date > last.anchorDay))
      last = { anchor: photo, anchorDay: date };
  }
  return last;
}

/** The photos with a date, in the order they were taken, ones taken at the same time by file name. */
function inTakenOrder(photos: SocialPhoto[], changed: Map<string, unknown>): SocialPhoto[] {
  return photos
    .map((photo) => ({ photo, taken: takenWithChange(photo, changed) }))
    .filter(({ taken }) => taken !== "")
    .toSorted((a, b) => a.taken.localeCompare(b.taken) || a.photo.file.localeCompare(b.photo.file))
    .map(({ photo }) => photo);
}

/**
 * The 3 photos taken just before and the 5 just after the photo on the latest calendar day before
 * day, by when they were taken (custom date or EXIF), whether or not they're scheduled. Only photos
 * that pass allowed count, such as the ones the Focus lets through. Null when no photo is on the
 * calendar before day, or that photo has no date. changed holds the photo files' changes not
 * committed yet, by path.
 */
export function neighborsFor(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string,
  changed: Map<string, unknown>,
  allowed: (photo: SocialPhoto) => boolean,
): Neighbors | null {
  const last = lastScheduledBefore(photos, unsaved, day);
  if (!last) return null;
  const ordered = inTakenOrder(photos, changed);
  const at = ordered.findIndex((photo) => photo.path === last.anchor.path);
  if (at === -1) return null;
  const before = ordered.slice(0, at).filter(allowed).slice(-BEFORE_COUNT);
  const after = ordered
    .slice(at + 1)
    .filter(allowed)
    .slice(0, AFTER_COUNT);
  return {
    ...last,
    photos: [
      ...before.map((photo, i) => ({ photo, offset: i - before.length })),
      ...after.map((photo, i) => ({ photo, offset: i + 1 })),
    ],
  };
}
