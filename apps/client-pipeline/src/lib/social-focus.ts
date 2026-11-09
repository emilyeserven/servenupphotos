import type { SocialPhoto } from "@/api/publish";
import { CREATE_DATE } from "@/lib/photo-fields";

/**
 * The Instagram calendar's Focus: the filters its photo picker starts with, so picking a photo for a
 * day only offers the kind of photo being posted these weeks. An empty field doesn't filter.
 */
export interface SocialFocus {
  /** Only photos marked eligible for social media. */
  eligibleOnly: boolean;
  /** Taken on or after this day, as YYYY-MM-DD, or "". */
  takenFrom: string;
  /** Taken on or before this day, as YYYY-MM-DD, or "". */
  takenTo: string;
  /** Text the photo's city, state, country or place name has, such as "Japan", or "". */
  place: string;
  /** Tags the photo has at least one of. */
  tags: string[];
  /** Genres the photo has at least one of. */
  genres: string[];
}

/** A Focus that lets every photo through. */
export const NO_FOCUS: SocialFocus = {
  eligibleOnly: false,
  takenFrom: "",
  takenTo: "",
  place: "",
  tags: [],
  genres: [],
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The custom value written on the Photo page, or else the one from EXIF. */
export function customOr(data: Record<string, unknown>, field: string): string {
  const name = `custom${field[0]?.toUpperCase()}${field.slice(1)}`;
  return text(data[name]) || text(data[field]);
}

/** The day the photo was taken, as YYYY-MM-DD, from its custom or EXIF date; "" when it has none. */
export function takenDay(data: Record<string, unknown>): string {
  const match = customOr(data, CREATE_DATE).match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/** The words typed in a Focus field as a list: split on commas, without "#" or blanks. */
export function parseList(typed: string): string[] {
  return typed
    .split(",")
    .map((item) => item.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

/** Whether day is on or after from; any day when from is "". */
function onOrAfter(day: string, from: string): boolean {
  return from === "" || day >= from;
}

/** Whether day is on or before to; any day when to is "". */
function onOrBefore(day: string, to: string): boolean {
  return to === "" || day <= to;
}

/** Whether the day is in the Focus's dates; a photo without a date is only in when no dates are set. */
function inRange(day: string, { takenFrom, takenTo }: SocialFocus): boolean {
  if (day === "") return takenFrom === "" && takenTo === "";
  return onOrAfter(day, takenFrom) && onOrBefore(day, takenTo);
}

function hasAny(have: unknown, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const lower = new Set(list(have).map((item) => item.toLowerCase()));
  return wanted.some((item) => lower.has(item.toLowerCase()));
}

const PLACE_FIELDS = ["city", "state", "country", "placeName"];

function inPlace(data: Record<string, unknown>, place: string): boolean {
  const wanted = place.trim().toLowerCase();
  if (!wanted) return true;
  return PLACE_FIELDS.some((field) => customOr(data, field).toLowerCase().includes(wanted));
}

/** Whether the photo passes every filter the Focus sets. */
export function matchesFocus({ data, isSocialMediaEligible }: SocialPhoto, focus: SocialFocus) {
  return [
    !focus.eligibleOnly || isSocialMediaEligible,
    inRange(takenDay(data), focus),
    inPlace(data, focus.place),
    hasAny(data.tags, focus.tags),
    hasAny(data.genres, focus.genres),
  ].every(Boolean);
}

/** Whether the Focus filters anything. */
export function isFocused(focus: SocialFocus): boolean {
  return JSON.stringify({ ...NO_FOCUS, ...focus }) !== JSON.stringify(NO_FOCUS);
}

/** Every tag or genre the photos have, sorted, to offer while typing a Focus. */
export function knownValues(photos: SocialPhoto[], field: "tags" | "genres"): string[] {
  const all = new Set(photos.flatMap(({ data }) => list(data[field])));
  return [...all].toSorted((a, b) => a.localeCompare(b));
}
