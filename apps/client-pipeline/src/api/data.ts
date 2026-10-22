import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/settings";

/** Base URLs to move the photos' image URLs between; both empty to only list the origins. */
export interface BaseUrlChange {
  from: string;
  to: string;
}

/** One scheme and host the photo files' image URLs point at. */
export interface ImageOrigin {
  origin: string;
  /** How many image URLs use it. */
  urls: number;
  /** How many photo files have at least one of them. */
  files: number;
}

/** One image URL the change rewrites. */
export interface UrlChange {
  /** Where the URL is in the photo's JSON, such as `images.medium`. */
  field: string;
  from: string;
  to: string;
}

export interface BaseUrlPreview {
  repo: string;
  folder: string;
  /** Where the files were read: the photo data pull request's branch, or the base branch. */
  branch: string;
  /** The open photo data pull request the change goes to; null when a new one would be opened. */
  pullRequest: { number: number; url: string } | null;
  /** The base URLs as the backend cleaned them up; empty when not given. */
  from: string;
  to: string;
  /** How many photo files were read. */
  photoFiles: number;
  /** Most used first. */
  origins: ImageOrigin[];
  /** The photo files with an image URL under `from`. */
  files: { path: string; fileUrl: string; changes: UrlChange[] }[];
  /** How many URLs change. */
  urls: number;
  /** Photo files that couldn't be read; while there are any, nothing can be changed. */
  unreadable: { path: string; error: string }[];
}

export interface BaseUrlResult {
  branch: string;
  commitSha: string;
  commitUrl: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
  /** True when the change opened the pull request. */
  newPullRequest: boolean;
  files: number;
  urls: number;
}

function post<T>(url: string, body: BaseUrlChange) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Reads every photo JSON file and previews moving their image URLs from one base URL to another. */
export const baseUrlPreviewQuery = (change: BaseUrlChange) =>
  queryOptions({
    queryKey: ["data", "image-base-url", change],
    queryFn: () => post<BaseUrlPreview>("/api/data/image-base-url/preview", change),
    retry: false,
    refetchOnWindowFocus: false,
  });

/** Moves the image URLs in every photo JSON file, as one commit in the photo data pull request. */
export const replaceBaseUrlMutation = mutationOptions({
  mutationKey: ["data", "image-base-url", "replace"],
  mutationFn: (change: BaseUrlChange) => post<BaseUrlResult>("/api/data/image-base-url", change),
});
