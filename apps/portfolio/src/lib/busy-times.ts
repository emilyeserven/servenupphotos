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

/** A unit of time the Timeline's Quick dates menu can show, from the most specific. */
export type TimeUnit = "day" | "week" | "month";

/** A day, week or month needs more photos than this for the Quick dates menu to offer it. */
const MIN_PHOTOS = 5;

/** Where each unit starts and ends around a date. Weeks start on Sunday, as on the heatmap. */
const UNITS: { unit: TimeUnit; start: (date: Date) => Date; end: (date: Date) => Date }[] = [
  { unit: "day", start: startOfDay, end: endOfDay },
  { unit: "week", start: startOfWeek, end: endOfWeek },
  { unit: "month", start: startOfMonth, end: endOfMonth },
];

/** The key a unit's count is kept under, such as "week:2026-09-06" for the week starting that Sunday. */
function unitKey({ unit, start }: (typeof UNITS)[number], date: Date): string {
  return `${unit}:${dayKey(start(date))}`;
}

/** How many photos were taken in each day, week and month, by `unitKey`. */
function countTimes(photos: Photo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { takenAt } of photos) {
    for (const unit of UNITS) {
      const key = unitKey(unit, takenAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** A day, week or month with more than five photos, which the Timeline's Quick dates menu offers. */
export interface BusyTime {
  /** Whether it's a day, week or month. */
  unit: TimeUnit;
  /** What the menu calls it, such as "Mon, Oct 26", "Week of Oct 25" or "October". */
  name: string;
  /** The heading it's listed under: the next less specific unit, such as its week, month or year. */
  group: string;
  /** How many photos were taken then. */
  count: number;
  /** The dates it covers, as the time range picker writes them in the URL. */
  range: TimeRangeValue;
  /** When it starts, which the menu lists newest first by. */
  start: Date;
}

/** What each unit is called in the menu, and the heading of the next less specific unit it's under. */
const BUSY_TEXT: Record<TimeUnit, { name: (date: Date) => string; group: (date: Date) => string }> =
  {
    day: {
      name: (date) => format(date, "EEE, MMM d"),
      group: (date) => `Week of ${format(startOfWeek(date), "MMM d, yyyy")}`,
    },
    week: {
      name: (date) => `Week of ${format(startOfWeek(date), "MMM d")}`,
      group: (date) => format(date, "MMMM yyyy"),
    },
    month: { name: (date) => format(date, "MMMM"), group: (date) => format(date, "yyyy") },
  };

/** How many photos were taken in the unit around the date. */
function countOf(counts: Map<string, number>, unit: (typeof UNITS)[number], date: Date): number {
  return counts.get(unitKey(unit, date)) ?? 0;
}

/** The busy time a photo falls in: its day, week or month, whichever is the most specific with more than five photos. */
function busyTimeOf(date: Date, counts: Map<string, number>): BusyTime | undefined {
  const unit = UNITS.find((each) => countOf(counts, each, date) > MIN_PHOTOS);
  if (!unit) return undefined;
  const start = unit.start(date);
  return {
    unit: unit.unit,
    name: BUSY_TEXT[unit.unit].name(start),
    group: BUSY_TEXT[unit.unit].group(start),
    count: countOf(counts, unit, date),
    range: absoluteTimeRange(start, unit.end(date)),
    start,
  };
}

/**
 * The busy times of the photos, newest first, grouped under the next less specific unit: each
 * photo's day, or else its week, or else its month, whichever is the most specific with more
 * than five photos. Photos in none of them are left out.
 */
export function busyTimes(photos: Photo[]): [string, BusyTime[]][] {
  const counts = countTimes(photos);
  const times = new Map<string, BusyTime>();
  for (const { takenAt } of photos) {
    const time = busyTimeOf(takenAt, counts);
    if (time) times.set(`${time.range.from}:${time.range.to}`, time);
  }
  return groupTimes([...times.values()].toSorted((a, b) => b.start.getTime() - a.start.getTime()));
}

/** Busy times grouped by their heading, keeping their order. */
function groupTimes(times: BusyTime[]): [string, BusyTime[]][] {
  const groups = new Map<string, BusyTime[]>();
  for (const time of times) groups.set(time.group, [...(groups.get(time.group) ?? []), time]);
  return [...groups];
}

/** Whether the dates cover exactly one of the unit's days, weeks or months. */
function coversUnit({ start, end }: (typeof UNITS)[number], from: Date, to: Date): boolean {
  return dayKey(start(from)) === dayKey(from) && dayKey(end(from)) === dayKey(to);
}

/**
 * The day, week or month a time range covers exactly, such as one picked from Quick dates;
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
