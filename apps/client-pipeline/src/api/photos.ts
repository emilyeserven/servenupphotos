import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { SanitizedExif } from "@/api/exif";
import { requestJson } from "@/api/settings";

/** A photo's data to save as `<folder>/<name>.json` in the GitHub repository from Settings. */
interface PhotoData {
  name: string;
  /** The photo's original file name. */
  file: string;
  sanitized: SanitizedExif;
}

export interface PublishResult {
  path: string;
  fileUrl: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
  /** False when the file was added to a photo data pull request that was already open. */
  newPullRequest: boolean;
}

export const publishPhotoMutation = mutationOptions({
  mutationKey: ["photos", "github"],
  mutationFn: (photo: PhotoData) =>
    requestJson<PublishResult>("/api/photos/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(photo),
    }),
});

/** The open "Add photo data" pull request. */
export interface InFlightPullRequest {
  number: number;
  title: string;
  url: string;
  branch: string;
  headSha: string;
}

/** One photo JSON file in the pull request, with its parsed data or why it couldn't be read. */
export interface InFlightFile {
  path: string;
  /** GitHub's change status, such as `added` or `modified`. */
  status: string;
  fileUrl: string;
  data?: unknown;
  error?: string;
  /** Whether the file's data is an entry of ALLPHOTOS.json; null when either couldn't be read. */
  inAllPhotos: boolean | null;
}

/** ALLPHOTOS.json, the combined photo list CI rebuilds on the pull request. */
export interface InFlightAllPhotos {
  path: string;
  /** False when the file isn't on the pull request's branch yet. */
  found: boolean;
  /** How many photos it lists. */
  count: number;
  error?: string;
}

export interface InFlightResponse {
  repo: string;
  folder: string;
  /** Null when no pull request titled "Add photo data" is open. */
  pullRequest: InFlightPullRequest | null;
  files: InFlightFile[];
  /** Not `found` when there is no pull request. */
  allPhotos: InFlightAllPhotos;
}

export const photosInFlightQuery = queryOptions({
  queryKey: ["photos", "in-flight"],
  queryFn: () => requestJson<InFlightResponse>("/api/photos/in-flight"),
  retry: false,
});
