import { format } from "date-fns";
import type { Photo } from "@/lib/photos";

/** A Quick dates choice: this date, this month or this season, in the years before. */
export type QuickDate = "date" | "month" | "season";

/** A Quick dates choice needs at least this many photos for the menu to offer it. */
const MIN_PHOTOS = 5;

/** The season of each month, January first, as the Northern Hemisphere's weather seasons. */
const SEASONS = [
  "Winter",
  "Winter",
  "Spring",
  "Spring",
  "Spring",
  "Summer",
  "Summer",
  "Summer",
  "Autumn",
  "Autumn",
  "Autumn",
  "Winter",
] as const;

/** The season a date falls in, such as "Autumn" for November. */
function seasonOf(date: Date): string {
  return SEASONS[date.getMonth()] ?? "";
}

/** Which year's season a date falls in, counting December toward the winter of the next year. */
function seasonYear(date: Date): number {
  return date.getFullYear() + (date.getMonth() === 11 ? 1 : 0);
}

/**
 * How each choice matches a photo: `phase` is what repeats each year (its day, month or season)
 * and `occurrence` is which year's it is, so the current one can be left out.
 */
const MATCHERS: Record<
  QuickDate,
  { phase: (date: Date) => string; occurrence: (date: Date) => string }
> = {
  date: {
    phase: (date) => format(date, "MM-dd"),
    occurrence: (date) => format(date, "yyyy-MM-dd"),
  },
  month: { phase: (date) => format(date, "MM"), occurrence: (date) => format(date, "yyyy-MM") },
  season: { phase: seasonOf, occurrence: (date) => `${seasonOf(date)} ${seasonYear(date)}` },
};

/** The choices in the order the menu lists them, with what each is called. */
export const QUICK_DATES: { value: QuickDate; label: string }[] = [
  { value: "date", label: "This date" },
  { value: "month", label: "This month" },
  { value: "season", label: "This season" },
];

/** What today's day, month or season is, shown beside each choice, such as "Nov 7", "November" or "Autumn". */
export function quickDateDetail(when: QuickDate, now: Date): string {
  if (when === "date") return format(now, "MMM d");
  return when === "month" ? format(now, "MMMM") : seasonOf(now);
}

/**
 * Whether a photo was taken on today's date, in today's month or in today's season, in an earlier
 * year: the current day, month or season itself is left out.
 */
export function inQuickDate(date: Date, when: QuickDate, now: Date): boolean {
  const { phase, occurrence } = MATCHERS[when];
  return phase(date) === phase(now) && occurrence(date) !== occurrence(now);
}

/** The choices with at least five of the photos, each with how many it has. */
export function quickDateChoices(photos: Photo[], now: Date) {
  return QUICK_DATES.map((choice) => ({
    ...choice,
    count: photos.filter(({ takenAt }) => inQuickDate(takenAt, choice.value, now)).length,
  })).filter(({ count }) => count >= MIN_PHOTOS);
}

/** The Quick dates choice in the URL (`?when=month`), when there's one. */
export function parseQuickDate(when: unknown): { when?: QuickDate } {
  return QUICK_DATES.some(({ value }) => value === when) ? { when: when as QuickDate } : {};
}
