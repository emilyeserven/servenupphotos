import type { SocialPhoto } from "@/api/publish";
import { isoDate, parseIsoDate } from "@/lib/calendar";

/** How the Instagram queue looks from today: the next photos and how long it lasts. */
export interface SocialQueue {
  /** The next scheduled photos from today on, soonest first, with their days. */
  next: { day: string; photo: SocialPhoto }[];
  /** Days in a row from today with a photo scheduled, before the first empty day. */
  daysLeft: number;
  /** The last day of that run, or null when today is empty. */
  lastDay: string | null;
  /** Scheduled days after the first empty day. */
  later: number;
}

/** The day after day, as YYYY-MM-DD. */
function nextDay(day: string): string {
  const date = parseIsoDate(day);
  date.setDate(date.getDate() + 1);
  return isoDate(date);
}

/** How many days in a row from today have a photo, and the last of them. */
function runFrom(byDay: Map<string, SocialPhoto>, today: string) {
  let day = today;
  let lastDay: string | null = null;
  let count = 0;
  while (byDay.has(day)) {
    lastDay = day;
    count += 1;
    day = nextDay(day);
  }
  return { daysLeft: count, lastDay };
}

/** The queue from today, given each scheduled day's photo; shown is how many photos to list. */
export function socialQueue(
  byDay: Map<string, SocialPhoto>,
  today: string,
  shown: number,
): SocialQueue {
  const upcoming = [...byDay.entries()]
    .filter(([day]) => day >= today)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([day, photo]) => ({ day, photo }));
  const run = runFrom(byDay, today);
  return { next: upcoming.slice(0, shown), ...run, later: upcoming.length - run.daysLeft };
}
