import { isoDate } from "@portfolio/lib/dates";

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The Sunday that starts date's week, at midnight. */
function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** `weeks` weeks of days from the Sunday `offset` weeks after this week's, as YYYY-MM-DD. */
export function calendarDays(today: Date, offset: number, weeks: number): string[] {
  const first = addDays(startOfWeek(today), offset * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => isoDate(addDays(first, i)));
}

/** A day as "Nov 3". */
export const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** A day as "Monday, November 3". */
export const longDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
