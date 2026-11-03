import type { SocialPhoto } from "@/api/publish";
import type { FileChange } from "@/lib/optimistic";
import { type SocialPostStatus, postStatus, savedSocialPosts } from "@/lib/social-posts";

/** A photo file whose social media posts are shown, from the gallery or in flight. */
export interface PostedPhotoFile {
  path: string;
  /** The photo's JSON, with any change waiting for Commit or local edit made. */
  data: Record<string, unknown>;
  /** The photo's title, or else its file name. */
  name: string;
  /** The Square Thumbnail, or else the smallest resized version; null when there's none. */
  image: string | null;
  /**
   * True for a photo in flight: not in ALLPHOTOS.json on the base branch yet, or with changes since
   * that aren't committed. False for one the Gallery shows as it is.
   */
  inFlight: boolean;
}

/** One post of a photo on a day, as a calendar of posts shows it. */
export interface DayPost {
  photo: PostedPhotoFile;
  /** Posted on or before today, scheduled after it; see `postStatus`. */
  status: SocialPostStatus;
  /** The post's link; empty before it's posted. */
  url: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The photo files changed since the last commit, each as its last change left it: path → its JSON,
 * or null when it was removed. Changes are in the order they were made, as the combined data store
 * keeps them.
 */
export function changedPhotoFiles(changes: FileChange[]): Map<string, unknown> {
  const files = new Map<string, unknown>();
  for (const change of changes) {
    if (change.kind === "photos") files.set(change.path, change.after);
  }
  return files;
}

const IMAGE_NAMES = ["thumbnail", "small", "xsmall", "medium", "large", "xlarge"];

/** The Square Thumbnail in a photo's JSON, or the smallest resized version there is. */
function imageOf(data: Record<string, unknown>): string | null {
  const images = isObject(data.images) ? data.images : {};
  const url = IMAGE_NAMES.map((name) => images[name]).find((u) => typeof u === "string" && u);
  return (url as string | undefined) ?? null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The photo's title, or its file name without the extension, or the JSON file's name. */
function nameOf(data: Record<string, unknown>, path: string): string {
  const file = text(data.file).replace(/\.[^.]*$/, "");
  return text(data.title) || file || (path.split("/").at(-1) ?? path);
}

function postedFile(path: string, data: Record<string, unknown>, inFlight: boolean) {
  return { path, data, name: nameOf(data, path), image: imageOf(data), inFlight };
}

/** A calendar photo with its last change made, or undefined when the change removed it. */
function withChange(photo: SocialPhoto, changed: Map<string, unknown>) {
  if (!changed.has(photo.path)) return postedFile(photo.path, photo.data, !photo.inAllPhotos);
  const data = changed.get(photo.path);
  return isObject(data) ? postedFile(photo.path, data, true) : undefined;
}

/**
 * Every photo file as the app has it now: the files read for the Publish pages (in flight ones
 * included) with the changes waiting for Commit and local edits made over them, and the files those
 * changes added since they were read. Nothing is fetched: both come from what the app already keeps.
 */
export function postedPhotoFiles(
  photos: SocialPhoto[],
  changed: Map<string, unknown>,
): PostedPhotoFile[] {
  const read = new Set(photos.map((photo) => photo.path));
  const files = photos.flatMap((photo) => withChange(photo, changed) ?? []);
  for (const [path, data] of changed) {
    if (!read.has(path) && isObject(data)) files.push(postedFile(path, data, true));
  }
  return files;
}

/**
 * Each day's posts on platform from the photos' `socialPosts`, gallery and in flight photos alike,
 * in the photos' order. Posts without a day are left out.
 */
export function postsByDay(files: PostedPhotoFile[], platform: string): Map<string, DayPost[]> {
  const days = new Map<string, DayPost[]>();
  for (const { day, post } of files.flatMap((photo) => datedPosts(photo, platform))) {
    days.set(day, [...(days.get(day) ?? []), post]);
  }
  return days;
}

/** The photo's posts on platform that have a day, each with its day. */
function datedPosts(photo: PostedPhotoFile, platform: string) {
  return savedSocialPosts(photo.data)
    .filter((post) => post.platform === platform && post.date)
    .map(({ date, url }) => ({
      day: date,
      post: { photo, status: postStatus(date), url: url.trim() },
    }));
}
