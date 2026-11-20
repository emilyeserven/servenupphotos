import { shortDate } from "@portfolio/lib/dates";

/** The days from start to end, such as "Sep 22, 2026 – Oct 2, 2026", or one day when they're the same. */
export function dayRange(start: string, end: string): string {
  return start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
}
