import type { Photo } from "@portfolio/lib/photos";
import { inQuickDate, parseQuickDate, type QuickDate } from "@portfolio/lib/quick-dates";

/** The "when" filters that take any number of choices: months and days of the week. */
const LIST_KEYS = ["month", "weekday"] as const;

type ListKey = (typeof LIST_KEYS)[number];

/** The time of day filter: a range of hours, such as "6-18" for 6 AM to 7 PM. */
export const TIME_KEY = "time";

/** The date range filter's first and last day, as YYYY-MM-DD. */
export const DATE_KEYS = ["start", "end"] as const;

/** The Quick dates filter: this date, month or season in the years before (`?when=month`). */
const QUICK_DATE_KEY = "when";

/**
 * The "when" filters every view with filters shares, as the URL names them: the months and days
 * of the week, across every year, the hours of the day, a range of dates, and the Timeline's Quick
 * dates (this date, month or season in the years before).
 */
export const WHEN_KEYS = [...LIST_KEYS, TIME_KEY, ...DATE_KEYS, QUICK_DATE_KEY] as const;

export type WhenKey = (typeof WHEN_KEYS)[number];

/** The "when" filters, each left out when it isn't set. */
export type WhenFilters = {
  /** Months by their lowercase English name, such as ["june", "july"], in any year. */
  month?: string[];
  /** Days of the week by their lowercase English name, such as ["saturday"]. */
  weekday?: string[];
  /** A range of hours on a 24-hour clock, such as "6-18". */
  time?: string;
  start?: string;
  end?: string;
  /** Today's date, month or season, in the years before. */
  when?: QuickDate;
};

/** One choice of a "when" filter, such as a month: its URL value, its names and whether a photo is in it. */
export interface WhenChoice {
  value: string;
  label: string;
  /** Its short name, such as "Mar", for a grid of buttons. */
  short: string;
  matches: (photo: Photo) => boolean;
}

/** A month's name, such as "March" or "Mar", for its number from 0. */
function monthName(number: number, style: "short" | "long" = "long"): string {
  return new Date(2000, number, 1).toLocaleString("en-US", { month: style });
}

/** A month, by its number from 0. */
function monthChoice(number: number): WhenChoice {
  return {
    value: monthName(number).toLowerCase(),
    label: monthName(number),
    short: monthName(number, "short"),
    matches: (photo) => photo.takenAt.getMonth() === number,
  };
}

/** The months, January first. */
export const MONTHS: WhenChoice[] = Array.from({ length: 12 }, (_, number) => monthChoice(number));

/** A season: a shortcut for its three months, as the northern hemisphere has them. */
export interface Season {
  value: string;
  label: string;
  /** Its months, in order, winter's wrapping round the new year. */
  months: WhenChoice[];
}

/** A season by the numbers of its months from 0. */
function season(label: string, numbers: number[]): Season {
  return { value: label.toLowerCase(), label, months: numbers.map((n) => MONTHS[n]!) };
}

/** The seasons, spring first. */
export const SEASONS: Season[] = [
  season("Spring", [2, 3, 4]),
  season("Summer", [5, 6, 7]),
  season("Autumn", [8, 9, 10]),
  season("Winter", [11, 0, 1]),
];

/** A season's months as a range, such as "Mar–May". */
export function seasonSpan({ months }: Season): string {
  return `${months[0]!.short}–${months.at(-1)!.short}`;
}

/** A day of the week, by its number as `getDay()` counts, from Sunday. */
function weekdayChoice(day: number): WhenChoice {
  // 2023-01-01 was a Sunday.
  const date = new Date(2023, 0, 1 + day);
  const label = date.toLocaleString("en-US", { weekday: "long" });
  return {
    value: label.toLowerCase(),
    label,
    short: date.toLocaleString("en-US", { weekday: "short" }),
    matches: (photo) => photo.takenAt.getDay() === day,
  };
}

/** The days of the week, Monday first. */
export const WEEKDAYS: WhenChoice[] = [1, 2, 3, 4, 5, 6, 0].map(weekdayChoice);

/** A part of the day: a quick pick for the hours, from the start of its first hour to the end of its last. */
export interface Daypart {
  id: string;
  label: string;
  first: number;
  last: number;
}

/**
 * The parts of the day, by the clock where the photo was taken, as its capture time has no time
 * zone.
 */
export const DAYPARTS: Daypart[] = [
  { id: "late-night", label: "Late night", first: 0, last: 4 },
  { id: "early-morning", label: "Early morning", first: 5, last: 7 },
  { id: "morning", label: "Morning", first: 8, last: 11 },
  { id: "afternoon", label: "Afternoon", first: 12, last: 16 },
  { id: "evening", label: "Evening", first: 17, last: 20 },
  { id: "night", label: "Night", first: 21, last: 23 },
];

/** An hour as a 12-hour clock writes it, such as "5 AM" or "12 PM". */
function hourText(hour: number): string {
  return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** A part of the day's hours, such as "8 AM–12 PM". */
export function daypartSpan({ first, last }: Daypart): string {
  return `${hourText(first)}–${hourText(last + 1)}`;
}

/**
 * The hours a part of the day sets, from the first to the last of `hours` (the hours the photos
 * were taken in) inside it, so the hours slider can show it; undefined when none is.
 */
export function daypartRange({ first, last }: Daypart, hours: string[]): string | undefined {
  const inside = hours.filter((hour) => Number(hour) >= first && Number(hour) <= last);
  return inside.length > 0 ? `${inside[0]}-${inside.at(-1)}` : undefined;
}

/** Each list filter's choices. */
const LIST_CHOICES: Record<ListKey, WhenChoice[]> = { month: MONTHS, weekday: WEEKDAYS };

/** The list filter's known values in the URL's search, in their order, leaving out anything else. */
function parseList(key: ListKey, value: unknown): string[] {
  const list: unknown[] = Array.isArray(value) ? value : [value];
  return LIST_CHOICES[key].map((c) => c.value).filter((known) => list.includes(known));
}

/** A YYYY-MM-DD date in the URL's search, or undefined for anything else. */
function parseDay(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** A range of hours in the URL's search, such as "6-18", or undefined for anything else. */
function parseHours(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{1,2}-\d{1,2}$/.test(value) ? value : undefined;
}

/** Whether a filter's value is set: some text, or a list with something in it. */
function isSet(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== undefined;
}

/** The "when" filters in the URL's search, leaving out anything that isn't one or is empty. */
export function parseWhen(search: Record<string, unknown>): WhenFilters {
  const parsed: Record<string, unknown> = {
    month: parseList("month", search.month),
    weekday: parseList("weekday", search.weekday),
    time: parseHours(search[TIME_KEY]),
    start: parseDay(search.start),
    end: parseDay(search.end),
    ...parseQuickDate(search[QUICK_DATE_KEY]),
  };
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isSet(value)));
}

/** Whether a date range is set, from either end. */
export function hasDateRange(filters: WhenFilters): boolean {
  return filters.start !== undefined || filters.end !== undefined;
}

/**
 * How many "when" filters are set: the months, the days, the hours, the date range and the Quick
 * date count one each.
 */
export function whenCount(filters: WhenFilters): number {
  const set = [filters.month, filters.weekday, filters.time, filters.when].filter(isSet).length;
  return set + Number(hasDateRange(filters));
}

/** Whether the photo is in one of the list filter's choices, or none are chosen. */
function matchesList(photo: Photo, key: ListKey, values: string[] | undefined): boolean {
  if (!values) return true;
  return LIST_CHOICES[key].some((choice) => values.includes(choice.value) && choice.matches(photo));
}

/** Whether the photo was taken within the hours, from the start of the first to the end of the last. */
function matchesHours(photo: Photo, time: string | undefined): boolean {
  if (!time) return true;
  const [low = 0, high = 23] = time.split("-").map(Number);
  const hour = photo.takenAt.getHours();
  return hour >= low && hour <= high;
}

/** Two digits, such as "05". */
function pad(number: number): string {
  return String(number).padStart(2, "0");
}

/** The day of a date as YYYY-MM-DD, by the clock where the photo was taken. */
export function dayOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whether the photo was taken from the first day to the last, both included; a missing end is open. */
function matchesDates(photo: Photo, { start = "", end = "9999-12-31" }: WhenFilters): boolean {
  const day = dayOf(photo.takenAt);
  return day >= start && day <= end;
}

/** Whether the photo matches every "when" filter that's set. */
export function matchesWhen(photo: Photo, filters: WhenFilters): boolean {
  const lists = LIST_KEYS.every((key) => matchesList(photo, key, filters[key]));
  return (
    lists &&
    matchesHours(photo, filters.time) &&
    matchesDates(photo, filters) &&
    matchesQuickDate(photo, filters.when)
  );
}

/** Whether the photo was taken on today's date, month or season in an earlier year, or none is chosen. */
function matchesQuickDate(photo: Photo, when: QuickDate | undefined): boolean {
  return !when || inQuickDate(photo.takenAt, when, new Date());
}
