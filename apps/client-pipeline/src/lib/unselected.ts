import type { ComparePhoto } from "@/lib/compare-groups";
import { isUnselected } from "@/lib/drafts";

/** The photo JSON field marking a photo as not chosen in a compare group, or left out (or `null`). */
export const UNSELECTED = "unselected";

/** What's left of an unselected photo in R2. */
export type UnselectedImages = "kept" | "small" | "deleted";

/** How each choice of what to keep in R2 reads. */
export const UNSELECTED_IMAGES: Record<UnselectedImages, string> = {
  kept: "Still in R2",
  small: "Only its Small versions and thumbnails are in R2",
  deleted: "Deleted from R2",
};

/** Why a photo wasn't chosen in its compare group, kept in its JSON as `unselected`. */
export interface Unselected {
  /** Why it wasn't chosen, in the user's words; "" when no reason is given yet. */
  reason: string;
  /** The IDs of the photos chosen over it. */
  winners: number[];
  /** The compare group it lost in. */
  group: string;
  /** The day it was set aside, as YYYY-MM-DD. */
  date: string;
  /** What's left of it in R2. */
  images: UnselectedImages;
}

/** The photo's `unselected`, or undefined when it isn't one. */
export function unselectedOf(photo: ComparePhoto): Unselected | undefined {
  return isUnselected(photo.data) ? (photo.data[UNSELECTED] as Unselected) : undefined;
}

/** The photos that weren't chosen, newest first. */
export function unselectedPhotos(photos: ComparePhoto[]): ComparePhoto[] {
  return photos
    .filter((photo) => isUnselected(photo.data))
    .toSorted((a, b) => String(unselectedOf(b)?.date).localeCompare(String(unselectedOf(a)?.date)));
}

/** The photo's ID, when its JSON has one. */
export function photoId(photo: ComparePhoto): number | undefined {
  return typeof photo.data.id === "number" ? photo.data.id : undefined;
}

/** The resized versions bigger than Small, deleted whatever is kept. */
const LARGE_VERSIONS = ["xlarge", "large", "medium"];

/** The Small versions and the thumbnails, kept when only they are. */
const SMALL_VERSIONS = ["small", "xsmall", "preview", "thumbnail", "thumbnailpreview"];

/** The R2 key at the end of url, without its query, such as a Square Thumbnail's crop mark. */
function keyOfUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  return new URL(url).pathname.slice(1) || undefined;
}

/** The photo's `images.key`, when its JSON saves one. */
function savedKey(images: Record<string, unknown>): string | undefined {
  return typeof images.key === "string" && images.key ? images.key : undefined;
}

/** The R2 key of the photo's original: its JSON's `images.key`, else its `images.full`, else the image found in R2. */
function originalKey(photo: ComparePhoto): string | undefined {
  const images = (photo.data.images ?? {}) as Record<string, unknown>;
  return savedKey(images) ?? keyOfUrl(images.full) ?? keyOfUrl(photo.imageUrl);
}

/**
 * The R2 keys to delete so only `keep` is left: the original and every resized version bigger than
 * Small, and with `deleted` the Small versions and thumbnails too. Each version sits next to the
 * original as `<name>-<version>.webp`. Empty when the photo's image isn't known.
 */
export function keysToDelete(photo: ComparePhoto, keep: "small" | "deleted"): string[] {
  const key = originalKey(photo);
  if (!key) return [];
  const stem = key.replace(/\.[^./]+$/, "");
  const versions = keep === "small" ? LARGE_VERSIONS : [...LARGE_VERSIONS, ...SMALL_VERSIONS];
  return [key, ...versions.map((version) => `${stem}-${version}.webp`)];
}

/** n as two digits, such as "07". */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today as YYYY-MM-DD, in local time. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
