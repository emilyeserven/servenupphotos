import type { ChangelogEntry } from "@/api/changelog";

/** The changes that landed on one day, in the browser's time zone. */
export interface ChangelogDay {
  /** The day as YYYY-MM-DD, which keys it. */
  day: string;
  /** The day's changes, newest first. */
  entries: ChangelogEntry[];
}

/** The local YYYY-MM-DD of an RFC 3339 time. */
function localDay(date: string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The entries grouped by the day they landed, keeping their order (newest first), leaving out photo
 * data merges unless withPhotoData.
 */
export function changelogDays(entries: ChangelogEntry[], withPhotoData: boolean): ChangelogDay[] {
  const byDay = new Map<string, ChangelogEntry[]>();
  for (const entry of entries.filter((e) => withPhotoData || !e.photoData)) {
    const day = localDay(entry.date);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  return [...byDay].map(([day, dayEntries]) => ({ day, entries: dayEntries }));
}
