import {
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfWeek,
  endOfYear,
  format,
  getYear,
  startOfWeek,
  startOfYear,
} from "date-fns";

/** How dark a day's square is: 0 for no photos, up to 4 for the busiest days. */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

/** One day's square on the heatmap. */
export interface HeatmapDay {
  date: Date;
  /** The day as `yyyy-MM-dd`, which sorts in date order. */
  key: string;
  count: number;
  level: HeatmapLevel;
}

/** One year of the heatmap: a column per week, Sunday to Saturday, like GitHub's contribution graph. */
export interface HeatmapYear {
  year: number;
  /** Each week's seven days; null for days in the next or last year, or after today. */
  weeks: (HeatmapDay | null)[][];
  /** Each month's short name and the week it starts in, to label the columns. */
  months: { label: string; week: number }[];
  /** How many photos were taken that year. */
  total: number;
}

/** A day's key, as `yyyy-MM-dd`. */
export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** How many dates fall on each day, by its key. */
function countByDay(dates: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(dayKey(date), (counts.get(dayKey(date)) ?? 0) + 1);
  return counts;
}

/**
 * A day's level against the busiest day, in four steps above none. The steps are even on a log
 * scale, so one very busy day doesn't leave every other day in the palest color.
 */
function levelOf(count: number, max: number): HeatmapLevel {
  return Math.ceil((Math.log1p(count) / Math.log1p(max)) * 4) as HeatmapLevel;
}

/** A year's weeks of squares, leaving out days outside the year or after `today`. */
function yearWeeks(year: number, today: Date, dayOf: (date: Date) => HeatmapDay) {
  const first = startOfYear(new Date(year, 0, 1));
  const days = eachDayOfInterval({ start: startOfWeek(first), end: endOfWeek(endOfYear(first)) });
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(
      days.slice(i, i + 7).map((date) => (inYear(date, year, today) ? dayOf(date) : null)),
    );
  }
  return weeks;
}

function inYear(date: Date, year: number, today: Date): boolean {
  return getYear(date) === year && date <= today;
}

/** Each month's short name and the week column its first day falls in. */
function monthLabels(year: number) {
  const first = startOfWeek(new Date(year, 0, 1));
  return Array.from({ length: 12 }, (_, month) => {
    const start = new Date(year, month, 1);
    return { label: format(start, "MMM"), week: differenceInCalendarWeeks(start, first) };
  });
}

/**
 * The photos' dates as a GitHub-style heatmap, one block per year from the first date's year to
 * `today`'s, newest year first.
 */
export function buildHeatmap(dates: Date[], first: Date, today: Date): HeatmapYear[] {
  const counts = countByDay(dates);
  const max = Math.max(1, ...counts.values());
  const dayOf = (date: Date): HeatmapDay => {
    const count = counts.get(dayKey(date)) ?? 0;
    return { date, key: dayKey(date), count, level: levelOf(count, max) };
  };
  const years: HeatmapYear[] = [];
  for (let year = getYear(today); year >= getYear(first); year--) {
    const total = dates.filter((date) => getYear(date) === year).length;
    years.push({ year, weeks: yearWeeks(year, today, dayOf), months: monthLabels(year), total });
  }
  return years;
}
