/**
 * The few ways the apps write a date, so every page shows the same look. Both apps share them: the
 * portfolio imports them as `@/lib/dates`, the pipeline as `@portfolio/lib/dates`. A day is text such
 * as "2026-11-03" and means that day where the photo was taken or on the user's own clock.
 */

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** A local date's day, such as "2026-11-03". */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A day such as "2026-11-03" as a local date at midnight. */
export function parseIsoDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A date, or a day such as "2026-11-03", as a local date. */
function asDate(date: Date | string): Date {
  return typeof date === "string" ? parseIsoDate(date) : date;
}

/** A date, or a day such as "2026-11-03", as "Nov 3, 2026". */
export function shortDate(date: Date | string): string {
  return SHORT_DATE.format(asDate(date));
}

/** A date, or a day such as "2026-11-03", as "Tue, Nov 3, 2026". */
export function weekdayDate(date: Date | string): string {
  return WEEKDAY_DATE.format(asDate(date));
}

/**
 * A moment, such as a file's upload time, as its day and time on the user's clock and in their
 * language, such as "Nov 3, 2026, 4:05 PM". Text is read as a timestamp, such as an ISO date and time.
 */
export function dateTimeText(moment: Date | string | number): string {
  return DATE_TIME.format(new Date(moment));
}
