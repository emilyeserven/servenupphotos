import { PUBLISH_DATE } from "@/lib/social-schedule";

/** Each day other photos post on, as YYYY-MM-DD, with those photos' names. */
export type UsedPostDays = Map<string, string[]>;

/** A photo JSON file, from the Gallery or the photo data pull request. */
interface PhotoFile {
  path: string;
  data?: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function day(value: unknown): string[] {
  return typeof value === "string" && value ? [value] : [];
}

/** The days in a photo's `socialPosts`, whatever their platform or status. */
function postDays(data: Record<string, unknown>): string[] {
  const posts = data.socialPosts;
  return Array.isArray(posts) ? posts.flatMap((post) => day(record(post).date)) : [];
}

/** Every day the photo posts on: its posts' days and its day on the Instagram calendar. */
function photoDays(data: Record<string, unknown>): Set<string> {
  return new Set([...day(data[PUBLISH_DATE]), ...postDays(data)]);
}

/** The photo's title, or else its file name without the folder or ".json". */
function photoLabel(path: string, data: Record<string, unknown>): string {
  const title = typeof data.title === "string" ? data.title.trim() : "";
  return title || (path.split("/").pop() ?? path).replace(/\.json$/, "");
}

/** Each file's latest data by path: a later file replaces an earlier one at the same path. */
function latestByPath(files: PhotoFile[]): Map<string, Record<string, unknown>> {
  return new Map(files.map((file) => [file.path, record(file.data)]));
}

function addDay(used: UsedPostDays, date: string, label: string) {
  used.set(date, [...(used.get(date) ?? []), label]);
}

/**
 * The days the photos other than the one at exceptPath already post on. files lists the Gallery's
 * photos first and the pull request's after them, so a photo the pull request changes counts with
 * its days there.
 */
export function usedPostDays(files: PhotoFile[], exceptPath: string): UsedPostDays {
  const used: UsedPostDays = new Map();
  for (const [path, data] of latestByPath(files)) {
    if (path === exceptPath) continue;
    for (const date of photoDays(data)) addDay(used, date, photoLabel(path, data));
  }
  return used;
}
