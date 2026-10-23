import { canonicalJson } from "@/lib/combined";

/** The photo JSON field that lists the photo's posts on social media. */
const SOCIAL_POSTS = "socialPosts";

/** A social media site a photo can be posted to. */
interface SocialPlatform {
  /** What a post's `platform` holds, such as "instagram". */
  id: string;
  label: string;
}

/** Every platform the Photo page offers, in the order it lists them. Add one here to offer it. */
export const socialPlatforms: SocialPlatform[] = [
  { id: "instagram", label: "Instagram" },
  { id: "threads", label: "Threads" },
  { id: "bluesky", label: "Bluesky" },
  { id: "facebook", label: "Facebook" },
  { id: "other", label: "Other" },
];

/** Whether a post is waiting to go up or already up. */
export type SocialPostStatus = "scheduled" | "posted";

/** One post of the photo on social media, as the photo JSON's `socialPosts` saves it. */
export interface SocialPost {
  platform: string;
  status: SocialPostStatus;
  /** The day it's posted or scheduled for, as YYYY-MM-DD, or null when it isn't known. */
  date: string | null;
  /** The post's link; empty before it's posted. */
  url: string;
  /** The post's text, without its hashtags. */
  caption: string;
  /** The post's hashtags, without their "#". */
  hashtags: string[];
}

/** A post being edited on the Photo page: its hashtags as typed, and an id for React to tell rows apart. */
export interface SocialPostDraft extends Omit<SocialPost, "hashtags" | "date"> {
  id: string;
  date: string;
  hashtags: string;
}

let nextId = 0;

function draftId(): string {
  nextId += 1;
  return `social-post-${nextId}`;
}

/** A new post, scheduled on Instagram with nothing else filled in. */
export function newSocialPost(): SocialPostDraft {
  return {
    id: draftId(),
    platform: "instagram",
    status: "scheduled",
    date: "",
    url: "",
    caption: "",
    hashtags: "",
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The hashtags typed in a draft: split on spaces and commas, without their "#". */
export function parseHashtags(typed: string): string[] {
  return typed
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, ""))
    .filter(Boolean);
}

function savedHashtags(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

/** A saved post as a draft to edit. */
function toDraft(post: Record<string, unknown>): SocialPostDraft {
  return {
    id: draftId(),
    platform: text(post.platform) || "other",
    status: post.status === "posted" ? "posted" : "scheduled",
    date: text(post.date),
    url: text(post.url),
    caption: text(post.caption),
    hashtags: savedHashtags(post.hashtags)
      .map((tag) => `#${tag}`)
      .join(" "),
  };
}

/** The posts saved in a photo's JSON, as drafts to start editing from; none when it has no list. */
export function savedSocialPosts(data: Record<string, unknown>): SocialPostDraft[] {
  const posts = data[SOCIAL_POSTS];
  return Array.isArray(posts) ? posts.filter(isObject).map(toDraft) : [];
}

/** A draft as it's saved, with its text trimmed. */
function toSaved({ platform, status, date, url, caption, hashtags }: SocialPostDraft): SocialPost {
  return {
    platform,
    status,
    date: date || null,
    url: url.trim(),
    caption: caption.trim(),
    hashtags: parseHashtags(hashtags),
  };
}

/** The drafts as the photo JSON's `socialPosts` saves them. */
function socialPostsToSave(drafts: SocialPostDraft[]): SocialPost[] {
  return drafts.map(toSaved);
}

/** data with the drafts as its "socialPosts", where it has them, or else last. */
export function withSocialPosts<T extends object>(data: T, drafts: SocialPostDraft[]) {
  return { ...data, [SOCIAL_POSTS]: socialPostsToSave(drafts) };
}

/** Whether the drafts save something other than the posts saved in data. */
export function socialPostsChanged(data: Record<string, unknown>, drafts: SocialPostDraft[]) {
  const saved = socialPostsToSave(savedSocialPosts(data));
  return canonicalJson(saved) !== canonicalJson(socialPostsToSave(drafts));
}

/** The platform's name, or its id when the Photo page doesn't list it. */
export function platformLabel(id: string): string {
  return socialPlatforms.find((platform) => platform.id === id)?.label ?? id;
}
