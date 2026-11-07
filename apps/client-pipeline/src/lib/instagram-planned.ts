import { isSetAside } from "@/lib/drafts";
import type { PostedPhotoFile } from "@/lib/social-post-days";
import { type SocialPostDraft, newSocialPost, savedSocialPosts } from "@/lib/social-posts";

/** A photo still to put on Instagram, as the Planned page walks through them. */
export interface PlannedPhoto {
  file: PostedPhotoFile;
  /** The day it's planned for, as YYYY-MM-DD, or "" when it has none. */
  day: string;
  /**
   * Its planned Instagram post, with its place in the photo's `socialPosts`; undefined when the
   * photo is only on the Instagram calendar.
   */
  post: { index: number; draft: SocialPostDraft } | undefined;
}

/** The photo's day on the Instagram calendar (`socialMediaPublishDate`), or "". */
function calendarDay(data: Record<string, unknown>): string {
  const day = data.socialMediaPublishDate;
  return typeof day === "string" ? day : "";
}

/** The photo's first planned Instagram post, with its place in the list. */
function plannedPost(posts: SocialPostDraft[]): PlannedPhoto["post"] {
  const index = posts.findIndex((p) => p.platform === "instagram" && p.status === "planned");
  const draft = posts[index];
  return draft && { index, draft };
}

/** Whether the photo has an Instagram post that's already scheduled. */
function hasScheduled(posts: SocialPostDraft[]): boolean {
  return posts.some((p) => p.platform === "instagram" && p.status === "scheduled");
}

/** The day a planned post goes up: its own, or else the photo's calendar day. */
function postDay(post: SocialPostDraft, file: PostedPhotoFile): string {
  return post.date || calendarDay(file.data);
}

/**
 * The photo as a planned photo: when it has a planned Instagram post, or is on the Instagram
 * calendar without one that's scheduled. Undefined otherwise.
 */
function plannedOf(file: PostedPhotoFile): PlannedPhoto | undefined {
  const posts = savedSocialPosts(file.data);
  const post = plannedPost(posts);
  if (post) return { file, day: postDay(post.draft, file), post };
  const day = calendarDay(file.data);
  if (!day || hasScheduled(posts)) return undefined;
  return { file, day, post: undefined };
}

/** Days in order, with no day last. */
function byDay(a: PlannedPhoto, b: PlannedPhoto): number {
  return (a.day || "~").localeCompare(b.day || "~") || a.file.name.localeCompare(b.file.name);
}

/**
 * The photos still to put on Instagram, in the order they go up: by their planned day, those
 * without one last. Photos set aside as Undecided are left out, as on the calendar.
 */
export function plannedPhotos(files: PostedPhotoFile[]): PlannedPhoto[] {
  return files
    .filter((file) => !isSetAside(file.data))
    .flatMap((file) => plannedOf(file) ?? [])
    .toSorted(byDay);
}

/**
 * The photo's posts with its planned Instagram post marked scheduled, keeping its own caption or
 * else taking caption; a photo only on the calendar gets a new scheduled Instagram post on its day.
 */
export function withScheduled(planned: PlannedPhoto, caption: string): SocialPostDraft[] {
  const posts = savedSocialPosts(planned.file.data);
  const { post, day } = planned;
  if (!post) return [...posts, { ...newSocialPost(), status: "scheduled", date: day, caption }];
  return posts.map((p, i) => (i === post.index ? scheduledDraft(p, day, caption) : p));
}

function scheduledDraft(post: SocialPostDraft, day: string, caption: string): SocialPostDraft {
  return { ...post, status: "scheduled", date: day, caption: post.caption.trim() || caption };
}
