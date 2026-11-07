import { queryOptions } from "@tanstack/react-query";
import type { CombinedFile } from "@/api/photos";
import { requestJson } from "@/api/settings";

/** A photo JSON file as the backend reads it for the Instagram calendar. */
interface SocialPhotoRead {
  path: string;
  fileUrl: string;
  /** The photo's original file name; with its GPS position and creation date, its PhotoIdentity. */
  file: string;
  gpsPosition: string | null;
  createDate: string | null;
  title: string | null;
  /** The Square Thumbnail, or else the smallest resized version; null when there's none. */
  image: string | null;
  isSocialMediaEligible: boolean;
  /** YYYY-MM-DD, or null when the photo isn't scheduled. */
  socialMediaPublishDate: string | null;
  /** The whole file, so a date change shows in ALLPHOTOS.json before it's committed. */
  data: Record<string, unknown>;
}

/** A photo JSON file as the Instagram calendar shows it. */
export interface SocialPhoto extends SocialPhotoRead {
  /** Whether the photo is an entry of ALLPHOTOS.json on the base branch; false while it's in flight. */
  inAllPhotos: boolean;
}

/** Every photo file, as the backend reads them. */
export interface SocialCalendarRead {
  repo: string;
  folder: string;
  /** Where the photo files were read: the photo data pull request's branch, or the base branch. */
  branch: string;
  /** The open photo data pull request changes go to; null when a new one would be opened. */
  pullRequest: { number: number; url: string } | null;
  photos: SocialPhotoRead[];
  /** Photo files that couldn't be read; while there are any, nothing can be saved. */
  unreadable: { path: string; error: string }[];
}

/** Every photo file, each marked in flight or not from ALLPHOTOS.json on the base branch. */
export interface SocialCalendar extends Omit<SocialCalendarRead, "photos"> {
  /** ALLPHOTOS.json on the base branch, which tells photos in flight from ones already published. */
  allPhotos: CombinedFile;
  photos: SocialPhoto[];
}

/** Every photo JSON file with its social media publish date. */
export const socialCalendarQuery = queryOptions({
  queryKey: ["publish", "instagram"],
  queryFn: () => requestJson<SocialCalendarRead>("/api/attention"),
  retry: false,
  refetchOnWindowFocus: false,
});

/**
 * Every photo JSON file as the Dashboard's Needs attention counts from it: like the Instagram
 * calendar's, but each file's data without image URLs, EXIF originals or notes, and colors cut down
 * to their peakChroma, which makes it a fraction of the size. Saves and local edits are layered on
 * top by the card, so it's read once, and again after a Commit (commitSha) or a Discard.
 */
export function attentionQuery(commitSha: string | undefined) {
  return queryOptions({
    queryKey: ["publish", "attention", commitSha ?? "start"],
    queryFn: () => requestJson<SocialCalendarRead>("/api/attention"),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}
