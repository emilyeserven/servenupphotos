import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/settings";

/** A photo JSON file as the Instagram calendar shows it. */
export interface SocialPhoto {
  path: string;
  fileUrl: string;
  /** The photo's original file name. */
  file: string;
  title: string | null;
  /** The Square Thumbnail, or else the smallest resized version; null when there's none. */
  image: string | null;
  isSocialMediaEligible: boolean;
  /** YYYY-MM-DD, or null when the photo isn't scheduled. */
  socialMediaPublishDate: string | null;
  /** Whether the photo is an entry of ALLPHOTOS.json on the base branch. */
  inAllPhotos: boolean;
}

export interface SocialCalendar {
  repo: string;
  folder: string;
  /** Where the photo files were read: the photo data pull request's branch, or the base branch. */
  branch: string;
  /** The open photo data pull request changes go to; null when a new one would be opened. */
  pullRequest: { number: number; url: string } | null;
  /** ALLPHOTOS.json on the base branch, which the photo picker lists from. */
  allPhotos: { path: string; found: boolean; fileUrl?: string; count: number; error?: string };
  photos: SocialPhoto[];
  /** Photo files that couldn't be read; while there are any, nothing can be saved. */
  unreadable: { path: string; error: string }[];
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
  queryFn: () => requestJson<SocialCalendar>("/api/publish/instagram"),
  retry: false,
  refetchOnWindowFocus: false,
});

/** Saves publish dates as one commit in the photo data pull request. */
export const setSocialDatesMutation = mutationOptions({
  mutationKey: ["publish", "instagram", "save"],
  mutationFn: (dates: SocialDate[]) =>
    requestJson<SocialDatesResult>("/api/publish/instagram", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dates }),
    }),
});
