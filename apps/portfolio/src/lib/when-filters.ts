import type { Photo } from "@portfolio/lib/photos";

/**
 * The "when" filters that take any number of choices of one kind, in any year: seasons, months,
 * days of the week and hours of the day.
 */
export const LIST_KEYS = ["season", "month", "weekday", "hour"] as const;

export type ListKey = (typeof LIST_KEYS)[number];

/** The date range filter's first and last day, as YYYY-MM-DD. */
const DATE_KEYS = ["start", "end"] as const;

/**
 * The "when" filters every view with filters shares, as the URL names them: seasons, months, days
 * of the week or hours, across every year, or a range of dates. The When picker sets one of them at
 * a time.
 */
export const WHEN_KEYS = [...LIST_KEYS, ...DATE_KEYS] as const;

export type WhenKey = (typeof WHEN_KEYS)[number];

/** The "when" filters, each left out when it isn't set. */
export type WhenFilters = Partial<Record<ListKey, string[]>> & {
  /** The first and last day of the date range, as YYYY-MM-DD; either can be left open. */
  start?: string;
  end?: string;
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

/** A season, as the northern hemisphere has them, with its three months. */
export interface Season extends WhenChoice {
  /** Its months, in order, winter's wrapping round the new year. */
  months: WhenChoice[];
}

/** A season by the numbers of its months from 0. */
function season(label: string, numbers: number[]): Season {
  const months = numbers.map((n) => MONTHS[n]!);
  return {
    value: label.toLowerCase(),
    label,
    short: label,
    months,
    matches: (photo) => numbers.includes(photo.takenAt.getMonth()),
  };
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

/** An hour as a 12-hour clock writes it, such as "5 AM" or "12 PM". */
function hourText(hour: number): string {
  return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** An hour of the day, from its start to the next hour, by its number on a 24-hour clock. */
function hourChoice(hour: number): WhenChoice {
  return {
    value: String(hour),
    label: `${hourText(hour)}–${hourText(hour + 1)}`,
    short: hourText(hour).replace(" ", "").toLowerCase(),
    matches: (photo) => photo.takenAt.getHours() === hour,
  };
}

/** The hours of the day, from midnight. */
const HOURS: WhenChoice[] = Array.from({ length: 24 }, (_, hour) => hourChoice(hour));

/** A part of the day: a shortcut for its hours. */
export interface Daypart {
  label: string;
  hours: WhenChoice[];
}

/** A part of the day, from the start of its first hour to the end of its last. */
function daypart(label: string, first: number, last: number): Daypart {
  return { label, hours: HOURS.slice(first, last + 1) };
}

/**
 * The parts of the day, by the clock where the photo was taken, as its capture time has no time
 * zone.
 */
export const DAYPARTS: Daypart[] = [
  daypart("Late night", 0, 4),
  daypart("Early morning", 5, 7),
  daypart("Morning", 8, 11),
  daypart("Afternoon", 12, 16),
  daypart("Evening", 17, 20),
  daypart("Night", 21, 23),
];

/** A part of the day's hours, such as "8 AM–12 PM". */
export function daypartSpan({ hours }: Daypart): string {
  const [start] = hours[0]!.label.split("–");
  return `${start}–${hours.at(-1)!.label.split("–")[1]}`;
}

/** Each list filter's choices. */
const LIST_CHOICES: Record<ListKey, WhenChoice[]> = {
  season: SEASONS,
  month: MONTHS,
  weekday: WEEKDAYS,
  hour: HOURS,
};

/** The list filter's known values in the URL's search, in their order, leaving out anything else. */
function parseList(key: ListKey, value: unknown): string[] {
  const list = (Array.isArray(value) ? value : [value]).map(String);
  return LIST_CHOICES[key].map((c) => c.value).filter((known) => list.includes(known));
}

/** A YYYY-MM-DD date in the URL's search, or undefined for anything else. */
function parseDay(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** Whether a filter's value is set: some text, or a list with something in it. */
function isSet(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== undefined;
}

/** The "when" filters in the URL's search, leaving out anything that isn't one or is empty. */
export function parseWhen(search: Record<string, unknown>): WhenFilters {
  const lists = LIST_KEYS.map((key) => [key, parseList(key, search[key])]);
  const parsed: Record<string, unknown> = {
    ...Object.fromEntries(lists),
    start: parseDay(search.start),
    end: parseDay(search.end),
  };
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isSet(value)));
}

/** Whether a date range is set, from either end. */
export function hasDateRange(filters: WhenFilters): boolean {
  return filters.start !== undefined || filters.end !== undefined;
}

/** How many "when" filters are set: each kind of list and the date range count one each. */
export function whenCount(filters: WhenFilters): number {
  const lists = LIST_KEYS.filter((key) => isSet(filters[key])).length;
  return lists + Number(hasDateRange(filters));
}

/** Whether the photo is in one of the list filter's choices, or none are chosen. */
function matchesList(photo: Photo, key: ListKey, values: string[] | undefined): boolean {
  if (!values) return true;
  return LIST_CHOICES[key].some((choice) => values.includes(choice.value) && choice.matches(photo));
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
  return lists && matchesDates(photo, filters);
}

/** What each kind of list calls its choice that `now` is in, such as "This season". */
export const CURRENT_LABELS: Record<ListKey, string> = {
  season: "This season",
  month: "This month",
  weekday: "Today",
  hour: "This hour",
};

/** The choice of a kind of list that `now` is in, such as Autumn for a day in November. */
export function currentChoice(key: ListKey, now: Date): WhenChoice {
  const asPhoto = { takenAt: now } as Photo;
  return LIST_CHOICES[key].find((choice) => choice.matches(asPhoto))!;
}
