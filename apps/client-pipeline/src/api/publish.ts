import { mutationOptions, queryOptions } from "@tanstack/react-query";
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

/** A new publish date for the photo file at `path`; null takes it off the calendar. */
interface SocialDate {
  path: string;
  date: string | null;
}

export interface SocialDatesResult {
  branch: string;
  commitSha: string;
  commitUrl: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
  /** True when saving opened the pull request. */
  newPullRequest: boolean;
  /** How many photo files changed. */
  files: number;
}

/** Every photo JSON file with its social media publish date. */
export const socialCalendarQuery = queryOptions({
  queryKey: ["publish", "instagram"],
  queryFn: () => requestJson<SocialCalendarRead>("/api/publish/instagram"),
  retry: false,
  refetchOnWindowFocus: false,
});

/** Saves publish dates as one commit in the photo data pull request. */
export const setSocialDatesMutation = mutationOptions({
  mutationKey: ["publish", "instagram", "save"],
  meta: { pushes: true },
  mutationFn: (dates: SocialDate[]) =>
    requestJson<SocialDatesResult>("/api/publish/instagram", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dates }),
    }),
});
