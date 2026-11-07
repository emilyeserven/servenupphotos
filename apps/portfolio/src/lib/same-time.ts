import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { dayKey } from "@/lib/heatmap";
import type { Photo } from "@/lib/photos";
import { absoluteTimeRange, getAbsoluteDates, type TimeRangeValue } from "@/lib/time-range";

/** A unit of time the Timeline's quick filter can show, from the most specific. */
export type TimeUnit = "day" | "week" | "month";

/** A photo's day, week or month needs more photos than this for its quick filter to offer it. */
const MIN_PHOTOS = 5;

/** Where each unit starts and ends around a date. Weeks start on Sunday, as on the heatmap. */
const UNITS: { unit: TimeUnit; start: (date: Date) => Date; end: (date: Date) => Date }[] = [
  { unit: "day", start: startOfDay, end: endOfDay },
  { unit: "week", start: startOfWeek, end: endOfWeek },
  { unit: "month", start: startOfMonth, end: endOfMonth },
];

/** The day, week or month a photo's quick filter shows, with how many photos it has. */
export interface SameTime {
  /** Whether it's the photo's day, week or month. */
  unit: TimeUnit;
  /** How many photos were taken then. */
  count: number;
  /** The dates it covers, as the time range picker writes them in the URL. */
  range: TimeRangeValue;
}

/** The key a unit's count is kept under, such as "week:2026-09-06" for the week starting that Sunday. */
function unitKey({ unit, start }: (typeof UNITS)[number], date: Date): string {
  return `${unit}:${dayKey(start(date))}`;
}

/** How many photos were taken in each day, week and month, by `unitKey`. */
export function countTimes(photos: Photo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { takenAt } of photos) {
    for (const unit of UNITS) {
      const key = unitKey(unit, takenAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The most specific of the photo's day, week or month with more than five photos, for its quick
 * filter; undefined when none has, or when the Timeline already shows exactly that time.
 */
export function sameTime(
  photo: Photo,
  counts: Map<string, number>,
  shown: TimeRangeValue,
): SameTime | undefined {
  const unit = UNITS.find((each) => countOf(counts, each, photo.takenAt) > MIN_PHOTOS);
  if (!unit) return undefined;
  const range = absoluteTimeRange(unit.start(photo.takenAt), unit.end(photo.takenAt));
  if (range.from === shown.from && range.to === shown.to) return undefined;
  return { unit: unit.unit, count: countOf(counts, unit, photo.takenAt), range };
}

/** How many photos were taken in the unit around the date. */
function countOf(counts: Map<string, number>, unit: (typeof UNITS)[number], date: Date): number {
  return counts.get(unitKey(unit, date)) ?? 0;
}

/** Whether the dates cover exactly one of the unit's days, weeks or months. */
function coversUnit({ start, end }: (typeof UNITS)[number], from: Date, to: Date): boolean {
  return dayKey(start(from)) === dayKey(from) && dayKey(end(from)) === dayKey(to);
}

/**
 * The day, week or month a time range covers exactly, such as one a photo's quick filter picked;
 * undefined for any other range.
 */
export function shownUnit(range: TimeRangeValue): TimeUnit | undefined {
  const dates = getAbsoluteDates(range);
  if (!dates) return undefined;
  return UNITS.find((unit) => coversUnit(unit, dates.from, dates.to))?.unit;
}

/** One level of the Timeline's headings: what each heading says, and the scrubber group it's in. */
export interface TimeDivision {
  /** The heading of the photos taken at the date, such as "September 2026". */
  heading: (date: Date) => string;
  /** The scrubber's group for the heading, such as its year, labelled at its first mark. */
  group: (date: Date) => string;
}

const MONTHS: TimeDivision = {
  heading: (date) => format(date, "MMMM yyyy"),
  group: (date) => format(date, "yyyy"),
};
const WEEKS: TimeDivision = {
  heading: (date) => `Week of ${format(startOfWeek(date), "MMMM d")}`,
  group: (date) => format(startOfWeek(date), "MMM"),
};
const DAYS: TimeDivision = {
  heading: (date) => format(date, "EEEE, MMMM d"),
  group: (date) => format(date, "MMM"),
};
const HOURS: TimeDivision = {
  heading: (date) => format(date, "h a"),
  group: (date) => format(date, "MMM"),
};

/**
 * How the Timeline divides its photos into headings and subheadings: by month and day, or, while
 * it shows one month, by week and day; one week, by day and hour; one day, by the day and its hours.
 */
export const TIME_DIVISIONS: Record<TimeUnit | "all", [TimeDivision, TimeDivision]> = {
  all: [MONTHS, DAYS],
  month: [WEEKS, DAYS],
  week: [DAYS, HOURS],
  day: [DAYS, HOURS],
};

/** What a quick filter's button says for each unit. */
export const SAME_TIME_TEXT: Record<TimeUnit, string> = {
  day: "Same day",
  week: "Same week",
  month: "Same month",
};
