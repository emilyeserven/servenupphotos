import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ExifResponse, SanitizedExif } from "@/api/exif";
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
  meta: { pushes: true },
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

/** One photo JSON file in the pull request, as the backend reads it. */
export interface InFlightFileRead {
  path: string;
  /** GitHub's change status, such as `added` or `modified`. */
  status: string;
  fileUrl: string;
  data?: unknown;
  error?: string;
  /** The photo's original file name, used to find its image in R2. */
  photoName: string;
  /** The photo's `images.full` R2 URL, when it was saved with the data. */
  imageUrl?: string;
  /** The photo's `images.key` R2 object key, when it was saved with the data. */
  imageKey?: string;
}

/** One photo JSON file in the pull request, with its parsed data or why it couldn't be read. */
export interface InFlightFile extends InFlightFileRead {
  /** Whether the file's data is an entry of ALLPHOTOS.json; null when either couldn't be read. */
  inAllPhotos: boolean | null;
}

/** A combined list CI builds, ALLPHOTOS.json, ALLALBUMS.json or ALLTAGS.json, read at one ref. */
export interface CombinedFile {
  path: string;
  /** False when the file isn't at the ref, or hasn't been read yet. */
  found: boolean;
  /** The file's page on GitHub, when it was found. */
  fileUrl?: string;
  /** How many photos it lists. */
  count: number;
  /** The file's JSON array, when it could be read. */
  data?: unknown[];
  error?: string;
}

/** ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json, read at one ref. */
export interface CombinedFiles {
  photos: CombinedFile;
  albums: CombinedFile;
  tags: CombinedFile;
}

/** The combined lists on the base branch and, when one is open, the photo data pull request. */
export interface CombinedData {
  repo: string;
  folder: string;
  base: CombinedFiles & { branch: string };
  /** At the pull request's head; null when no pull request titled "Add photo data" is open. */
  head: (CombinedFiles & { pullRequest: InFlightPullRequest }) | null;
}

/**
 * Reads the combined lists. Pages keep them in the combined data store rather than reading them
 * with each page; see `useCombinedData`.
 */
export function readCombinedData(): Promise<CombinedData> {
  return requestJson<CombinedData>("/api/photos/combined");
}

/** The photo data waiting in the pull request, as the backend reads it, without the combined lists. */
export interface InFlightRead {
  repo: string;
  folder: string;
  /** Null when no pull request titled "Add photo data" is open. */
  pullRequest: InFlightPullRequest | null;
  files: InFlightFileRead[];
  albums: { folder: string; files: InFlightGroupFileRead[] };
  tags: { folder: string; files: InFlightGroupFileRead[] };
  images: InFlightImages;
}

/** The photo data waiting in the pull request, checked against the combined lists at its head. */
export interface InFlightResponse extends Omit<InFlightRead, "files" | "albums" | "tags"> {
  files: InFlightFile[];
  /** ALLPHOTOS.json at the pull request's head; not `found` when there is no pull request. */
  allPhotos: CombinedFile;
  /** The album and tag files in the pull request. */
  albums: InFlightGroups;
  tags: InFlightGroups;
}

/** The album or tag files in the pull request, and the combined file CI rebuilds from them. */
export interface InFlightGroups {
  folder: string;
  files: InFlightGroupFile[];
  /** ALLALBUMS.json or ALLTAGS.json; not `found` when there is no pull request. */
  all: CombinedFile;
}

/** One album or tag file in the pull request, as the backend reads it. */
interface InFlightGroupFileRead {
  path: string;
  status: string;
  fileUrl: string;
  data?: unknown;
  error?: string;
}

/** One album or tag file in the pull request. */
export interface InFlightGroupFile extends InFlightGroupFileRead {
  /** Whether the file's data is an entry of the combined file; null when either couldn't be read. */
  inAll: boolean | null;
}

/** Each photo's image in R2, matched by the photo's file name. */
export interface InFlightImages {
  /** False when R2 couldn't be searched; `message` says why. */
  checked: boolean;
  message?: string;
  /** Keyed by the JSON file's path; a path that's missing has no image in R2. */
  byPath: Record<string, { key: string; url: string }>;
}

/** The photo data pull request's files; `useInFlight` checks them against the combined lists. */
export const photosInFlightQuery = queryOptions({
  queryKey: ["photos", "in-flight"],
  queryFn: () => requestJson<InFlightRead>("/api/photos/in-flight"),
  retry: false,
});

/** What saving an edit of a photo JSON file in the pull request did. */
export interface UpdateResult {
  path: string;
  fileUrl: string;
  /** The commit that changed the file, whose CI run rebuilds ALLPHOTOS.json; empty when unchanged. */
  commitSha: string;
  /** False when the file already had this content, so nothing was committed. */
  changed: boolean;
}

/**
 * Replaces the content of a photo JSON file in the open photo data pull request, moving it to
 * `name` (without .json) in the same folder when that's given.
 */
export const updateInFlightMutation = mutationOptions({
  mutationKey: ["photos", "in-flight", "update"],
  meta: { pushes: (result) => (result as UpdateResult).changed },
  mutationFn: (file: { path: string; data: unknown; name?: string }) =>
    requestJson<UpdateResult>("/api/photos/in-flight", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(file),
    }),
});

/** What removing a photo JSON file did, including to its image in R2. */
export interface RemoveResult {
  path: string;
  /** The commit that removed the file; its CI run rebuilds ALLPHOTOS.json. */
  commitSha: string;
  image: RemovedImage & {
    /** What happened to the image's resized WEBP versions, when its key was known. */
    versions?: RemovedImage[];
  };
}

interface RemovedImage {
  /** The R2 object that was deleted, or would have been. */
  key?: string;
  deleted: boolean;
  /** Why the image wasn't deleted, when it wasn't; absent when R2 had no image to delete. */
  message?: string;
}

export const removeInFlightMutation = mutationOptions({
  mutationKey: ["photos", "in-flight", "remove"],
  meta: { pushes: true },
  mutationFn: (path: string) =>
    requestJson<RemoveResult>(`/api/photos/in-flight?${new URLSearchParams({ path })}`, {
      method: "DELETE",
    }),
});

/** One image object in the R2 bucket. */
export interface BucketImage {
  key: string;
  url: string;
  /** Size in bytes. */
  size: number;
  /** When it was last uploaded, as an ISO timestamp. */
  modified: string;
}

interface BucketResponse {
  bucket: string;
  /** Every image in the bucket, newest first. */
  images: BucketImage[];
}

export const bucketImagesQuery = queryOptions({
  queryKey: ["photos", "bucket"],
  queryFn: () => requestJson<BucketResponse>("/api/photos/bucket"),
  retry: false,
});

/** Where the "Combine photo data" run that rebuilds ALLPHOTOS.json for one commit is. */
export interface CombineStatus {
  sha: string;
  /**
   * `waiting` until GitHub starts the run, then `running`, then `done` or `failed`. `unavailable`
   * when the token can't read Actions runs; `message` says why.
   */
  state: "waiting" | "running" | "done" | "failed" | "unavailable";
  runUrl?: string;
  /** The workflow's runs page, for when there's no runUrl yet. */
  runsUrl?: string;
  message?: string;
}

/** How often to check on a run that hasn't finished, and for how many checks at most. */
const COMBINE_POLL_MS = 3_000;
const COMBINE_MAX_POLLS = 100;

/** data's run state, treating no answer yet as waiting. */
export function combineState(data?: CombineStatus): CombineStatus["state"] {
  return data?.state ?? "waiting";
}

/** The states of a run that hasn't finished. */
export const COMBINE_PENDING: ReadonlySet<CombineStatus["state"]> = new Set(["waiting", "running"]);

/**
 * The "Combine photo data" run for commit `sha`, or for the photo data pull request's head when
 * `sha` is omitted. It polls until the run finishes.
 */
export const combineStatusQuery = (sha?: string) =>
  queryOptions({
    queryKey: ["photos", "ci", sha ?? "head"],
    queryFn: () =>
      requestJson<CombineStatus>(
        `/api/photos/in-flight/ci${sha ? `?${new URLSearchParams({ sha })}` : ""}`,
      ),
    retry: false,
    refetchInterval: ({ state }) =>
      COMBINE_PENDING.has(combineState(state.data)) && state.dataUpdateCount < COMBINE_MAX_POLLS
        ? COMBINE_POLL_MS
        : false,
  });

/** What makes a photo the same as an ALLPHOTOS.json entry: all three fields exactly equal. */
export interface PhotoIdentity {
  /** The photo's original file name. */
  file: string;
  gpsPosition: string | null;
  createDate: string | null;
}

/**
 * One place the check looked: ALLPHOTOS.json on the base branch, from the combined data store, or
 * the photo data pull request's files.
 */
export interface AllPhotosSource {
  /** The base branch's name, or the photo data pull request. */
  label: string;
  fileUrl: string;
  found: boolean;
  /** What couldn't be checked, when something couldn't. */
  error?: string;
}

/** An ALLPHOTOS.json entry for the same photo. */
export interface AllPhotosMatch {
  /** Where it was found first: the base branch, or a file in the pull request. */
  source: string;
  fileUrl: string;
  entry: unknown;
}

export interface AllPhotosCheck {
  /** ALLPHOTOS.json on the base branch. */
  path: string;
  sources: AllPhotosSource[];
  matches: AllPhotosMatch[];
}

/**
 * Looks for a photo in the open photo data pull request's files; with no pull request open, there
 * are no sources. ALLPHOTOS.json on the base branch is checked from the combined data store.
 */
export const pullRequestCheckQuery = (photo: PhotoIdentity) =>
  queryOptions({
    queryKey: ["photos", "all-photos", "check", photo],
    queryFn: () =>
      requestJson<Omit<AllPhotosCheck, "path">>("/api/photos/all-photos/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(photo),
      }),
    retry: false,
    staleTime: 0,
  });

/** Reads the EXIF and colors of an original already in R2, as the Add Photo page does for an upload. */
export const bucketExifMutation = mutationOptions({
  mutationKey: ["photos", "bucket", "exif"],
  mutationFn: (key: string) =>
    requestJson<ExifResponse>("/api/photos/bucket/exif", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    }),
});
