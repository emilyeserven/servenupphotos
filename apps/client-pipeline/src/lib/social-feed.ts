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
 * (`socialMediaPublishDate`), or an Instagram post under Social media posts, planned or scheduled.
 */
export type FeedSource = "calendar" | SocialPostStatus;

/** One tile of the Social Feed preview: a photo on Instagram on a day. */
export interface FeedEntry extends FeedPhoto {
  /** The day it posts, as YYYY-MM-DD. */
  day: string;
  source: FeedSource;
}

/** How sure a source is that the photo is on Instagram, so a scheduled post wins over the calendar. */
const SOURCE_RANK: Record<FeedSource, number> = { calendar: 0, planned: 1, scheduled: 2 };

/** Adds entry, or keeps the surer one when its photo is already on that day. */
function addEntry(entries: Map<string, FeedEntry>, entry: FeedEntry) {
  const key = `${entry.day}\n${entry.path}`;
  const kept = entries.get(key);
  if (!kept || SOURCE_RANK[entry.source] > SOURCE_RANK[kept.source]) entries.set(key, entry);
}

/**
 * Every photo the Instagram feed gets, newest first: each calendar day's photo (byDay) and each
 * Instagram post with a day (posts). A photo on the calendar and posted the same day is one tile.
 */
export function feedEntries(
  byDay: Map<string, FeedPhoto>,
  posts: Map<string, DayPost[]>,
): FeedEntry[] {
  const entries = new Map<string, FeedEntry>();
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
