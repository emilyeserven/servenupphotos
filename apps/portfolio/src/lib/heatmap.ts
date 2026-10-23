import {
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  startOfWeek,
} from "date-fns";

/** How dark a week's square is: 0 for no photos, up to 4 for the busiest weeks. */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

/** One week's square on the heatmap, Sunday to Saturday. */
export interface HeatmapWeek {
  /** Its Sunday and its Saturday. */
  start: Date;
  end: Date;
  /** Its Sunday and Saturday as `yyyy-MM-dd`, which sort in date order. */
  key: string;
  endKey: string;
  count: number;
  level: HeatmapLevel;
}

/** One year of the heatmap: a column per month, holding the weeks that start in it. */
export interface HeatmapYear {
  year: number;
  months: { label: string; weeks: HeatmapWeek[] }[];
  /** How many photos were taken in its weeks. */
  total: number;
}

/** A day's key, as `yyyy-MM-dd`. */
export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** How many dates fall in each week, by its Sunday's key. */
function countByWeek(dates: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(startOfWeek(date));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * A week's level against the busiest week, in four steps above none. The steps are even on a log
 * scale, so one very busy week doesn't leave every other week in the palest color.
 */
function levelOf(count: number, max: number): HeatmapLevel {
  return Math.ceil((Math.log1p(count) / Math.log1p(max)) * 4) as HeatmapLevel;
}

/** The Sundays in a month, up to `today`. */
function sundaysIn(year: number, month: number, today: Date): Date[] {
  const first = new Date(year, month, 1);
  return eachWeekOfInterval({ start: first, end: endOfMonth(first) }).filter(
    (sunday) => getMonth(sunday) === month && sunday <= today,
  );
}

/**
 * The photos' dates as a heatmap of weeks, one block per year from the first date's year to
 * `today`'s, oldest first. Each week belongs to the month its Sunday falls in.
 */
export function buildHeatmap(dates: Date[], first: Date, today: Date): HeatmapYear[] {
  const counts = countByWeek(dates);
  const max = Math.max(1, ...counts.values());
  const weekOf = (start: Date): HeatmapWeek => {
    const count = counts.get(dayKey(start)) ?? 0;
    const end = endOfWeek(start);
    return {
      start,
      end,
      key: dayKey(start),
      endKey: dayKey(end),
      count,
      level: levelOf(count, max),
    };
  };
  const years: HeatmapYear[] = [];
  for (let year = getYear(first); year <= getYear(today); year++) {
    const months = Array.from({ length: 12 }, (_, month) => ({
      label: format(new Date(year, month, 1), "MMM"),
      weeks: sundaysIn(year, month, today).map(weekOf),
    }));
    const total = months.flatMap((month) => month.weeks).reduce((sum, week) => sum + week.count, 0);
    years.push({ year, months, total });
  }
  return years;
}
