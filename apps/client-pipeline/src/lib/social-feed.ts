import { isoDate, parseIsoDate } from "@/lib/calendar";
import { notStoredPath } from "@/lib/not-stored";
import type { DayPost } from "@/lib/social-post-days";
import type { SocialPostStatus } from "@/lib/social-posts";

/** A photo on the Instagram calendar, as the Social Feed preview needs it. */
export interface FeedPhoto {
  path: string;
  /** The photo's title, or else its file name. */
  name: string;
  /** The Square Thumbnail, or else the smallest resized version; null when there's none. */
  image: string | null;
}

/**
 * Where a tile of the Social Feed preview comes from: a day on the Instagram calendar
 * (`socialMediaPublishDate`), an Instagram post under Social media posts, planned or scheduled, or
 * a Not Stored post, on Instagram with no photo in the portfolio.
 */
export type FeedSource = "calendar" | SocialPostStatus | "notStored";

/** One tile of the Social Feed preview: a photo on Instagram on a day. */
export interface FeedEntry extends FeedPhoto {
  /** The day it posts, as YYYY-MM-DD. */
  day: string;
  source: FeedSource;
}

/** How sure a source is that the photo is on Instagram, so a scheduled post wins over the calendar. */
const SOURCE_RANK: Record<FeedSource, number> = {
  calendar: 0,
  planned: 1,
  scheduled: 2,
  notStored: 3,
};

/** Adds entry, or keeps the surer one when its photo is already on that day. */
function addEntry(entries: Map<string, FeedEntry>, entry: FeedEntry) {
  const key = `${entry.day}\n${entry.path}`;
  const kept = entries.get(key);
  if (!kept || SOURCE_RANK[entry.source] > SOURCE_RANK[kept.source]) entries.set(key, entry);
}

/** The tile of a day's Not Stored post: named by its note, or "Not stored", with no image. */
function notStoredEntry(day: string, note: string): FeedEntry {
  const name = note.trim() || "Not stored";
  return { day, path: notStoredPath(day), name, image: null, source: "notStored" };
}

/**
 * Every photo the Instagram feed gets, newest first: each calendar day's photo (byDay), each
 * Instagram post with a day (posts) and each day's Not Stored post (notStored, by day). A photo on
 * the calendar and posted the same day is one tile.
 */
export function feedEntries(
  byDay: Map<string, FeedPhoto>,
  posts: Map<string, DayPost[]>,
  notStored: Map<string, { note: string }> = new Map(),
): FeedEntry[] {
  const entries = new Map<string, FeedEntry>();
  for (const [day, { note }] of notStored) addEntry(entries, notStoredEntry(day, note));
  for (const [day, { path, name, image }] of byDay) {
    addEntry(entries, { day, path, name, image, source: "calendar" });
  }
  for (const [day, dayPosts] of posts) {
    for (const { photo, status } of dayPosts) {
      const { path, name, image } = photo;
      addEntry(entries, { day, path, name, image, source: status });
    }
  }
  return [...entries.values()].toSorted((a, b) => b.day.localeCompare(a.day));
}

/** The feed as it looks at the end of asOf (YYYY-MM-DD): only the photos posted by then, newest first. */
export function feedAsOf(entries: FeedEntry[], asOf: string): FeedEntry[] {
  return entries.filter((entry) => entry.day <= asOf);
}

/** The day (YYYY-MM-DD) by days after day, or before it when by is negative. */
export function shiftDay(day: string, by: number): string {
  const date = parseIsoDate(day);
  return isoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + by));
}

/** The keys of a key press that say which way to step. */
interface StepKey {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

/** How many days a key press steps the Social Feed: -1 for ←, 1 for →, 0 for anything else or with a modifier. */
export function arrowStep({ key, altKey, ctrlKey, metaKey, shiftKey }: StepKey): number {
  if (altKey || ctrlKey || metaKey || shiftKey) return 0;
  return STEPS[key] ?? 0;
}
