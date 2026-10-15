import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  format,
  min,
  startOfDay,
} from "date-fns";

export interface HistogramBin {
  key: string;
  label: string;
  /** Short axis label, unique within one histogram (day bins never span more than a year). */
  tick: string;
  start: Date;
  end: Date;
  count: number;
}

/** Ranges up to this many days are binned per day; longer ones per month. */
const MAX_DAY_BINS = 92;

const resolutions = {
  day: {
    key: "yyyy-MM-dd",
    label: "MMM d, yyyy",
    tick: "MMM d",
    each: eachDayOfInterval,
    end: endOfDay,
  },
  month: {
    key: "yyyy-MM",
    label: "MMMM yyyy",
    tick: "MMM yyyy",
    each: eachMonthOfInterval,
    end: endOfMonth,
  },
};

export type HistogramResolution = keyof typeof resolutions;

function pickResolution(start: Date, end: Date): HistogramResolution {
  return differenceInCalendarDays(end, start) <= MAX_DAY_BINS ? "day" : "month";
}

/** Counts dates into day or month bins covering start..end, including empty bins. */
export function buildHistogram(dates: Date[], start: Date, end: Date) {
  const resolution = pickResolution(start, end);
  const { key, label, tick, each, end: binEnd } = resolutions[resolution];
  const counts = new Map<string, number>();
  for (const date of dates) {
    const bin = format(date, key);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }
  const bins = each({ start: startOfDay(start), end }).map((binStart): HistogramBin => ({
    key: format(binStart, key),
    label: format(binStart, label),
    tick: format(binStart, tick),
    start: binStart,
    end: min([binEnd(binStart), end]),
    count: counts.get(format(binStart, key)) ?? 0,
  }));
  return { resolution, bins };
}
