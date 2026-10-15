import {
  compareAsc,
  endOfDay,
  format,
  isValid,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

export const quickRanges = {
  "7d": { label: "Last 7 days", start: (now: Date) => subDays(now, 7) },
  "30d": { label: "Last 30 days", start: (now: Date) => subDays(now, 30) },
  "90d": { label: "Last 90 days", start: (now: Date) => subDays(now, 90) },
  "6m": { label: "Last 6 months", start: (now: Date) => subMonths(now, 6) },
  "1y": { label: "Last year", start: (now: Date) => subYears(now, 1) },
  all: { label: "All time", start: (): Date | undefined => undefined },
};

export type QuickRangeKey = keyof typeof quickRanges;

/**
 * A time range as it lives in the URL, in the spirit of Grafana's time range picker:
 * either a relative quick range (`?range=30d`) or absolute dates (`?from=2025-01-01&to=2025-03-31`).
 * No params means "All time".
 */
export interface TimeRangeValue {
  range?: QuickRangeKey;
  from?: string;
  to?: string;
}

const DATE_FORMAT = "yyyy-MM-dd";

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  return typeof value === "string" ? parseISO(value) : undefined;
}

function parseDate(value: unknown): Date | undefined {
  const date = toDate(value);
  return date && isValid(date) ? date : undefined;
}

function isQuickRangeKey(value: unknown): value is QuickRangeKey {
  return typeof value === "string" && value in quickRanges;
}

/** The absolute from/to dates of a value (ISO strings or Dates), or undefined when either is missing. */
function getAbsoluteDates(value: { from?: unknown; to?: unknown }) {
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  return from && to ? { from, to } : undefined;
}

/** Builds an absolute range value, swapping the dates if they are out of order. */
export function absoluteTimeRange(a: Date, b: Date): TimeRangeValue {
  const [from, to] = compareAsc(a, b) <= 0 ? [a, b] : [b, a];
  return { from: format(from, DATE_FORMAT), to: format(to, DATE_FORMAT) };
}

/** Validates untrusted search params into a TimeRangeValue, falling back to "All time". */
export function parseTimeRange(search: Record<string, unknown>): TimeRangeValue {
  const absolute = getAbsoluteDates(search);
  if (absolute) return absoluteTimeRange(absolute.from, absolute.to);
  return isQuickRangeKey(search.range) ? { range: search.range } : {};
}

/** The quick range a value selects, or undefined when it is an absolute range. */
export function activeQuickRange(value: TimeRangeValue): QuickRangeKey | undefined {
  return getAbsoluteDates(value) ? undefined : (value.range ?? "all");
}

/** Turns a TimeRangeValue into concrete bounds. An undefined start is open-ended. */
export function resolveTimeRange(value: TimeRangeValue, now: Date): { start?: Date; end: Date } {
  const absolute = getAbsoluteDates(value);
  if (absolute) return { start: startOfDay(absolute.from), end: endOfDay(absolute.to) };
  return { start: quickRanges[value.range ?? "all"].start(now), end: now };
}

export function describeTimeRange(value: TimeRangeValue): string {
  const absolute = getAbsoluteDates(value);
  if (!absolute) return quickRanges[value.range ?? "all"].label;
  return `${format(absolute.from, "MMM d, yyyy")} – ${format(absolute.to, "MMM d, yyyy")}`;
}
