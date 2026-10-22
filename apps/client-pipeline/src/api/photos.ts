import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ExifResponse, SanitizedExif } from "@/api/exif";
import type { PhotoPlace } from "@/api/places";
import { requestJson } from "@/api/settings";

/** A photo's data to save as `<folder>/<name>.json` in the GitHub repository from Settings. */
export interface PhotoData {
  name: string;
  /** The photo's original file name. */
  file: string;
  sanitized: SanitizedExif;
  /** The IDs of the albums and tags to save the photo in. */
  albums: string[];
  tags: string[];
  /** Where the photo was taken, as places from PLACES.json. */
  places: PhotoPlace[];
}

export interface PublishResult {
  path: string;
  fileUrl: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
  /** False when the file was added to a photo data pull request that was already open. */
  newPullRequest: boolean;
  /** The JSON saved. */
  data: unknown;
}

export const publishPhotoMutation = mutationOptions({
  mutationKey: ["photos", "github"],
  meta: {
    pushes: true,
    changes: (result) => {
      const { path, data } = result as PublishResult;
      return [{ kind: "photos", path, after: data }];
    },
  },
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
  /** The branch it merges into, which changed files' `base` is read from. */
  baseBranch?: string;
}

/** A changed file as it is on the pull request's base branch; both unset for an added file. */
export interface BaseFile {
  /** The file's JSON on the base branch, at its old path when the pull request renames it. */
  base?: unknown;
  /** Why `base` is missing, when the file should be on the base branch. */
  baseError?: string;
}

/** One photo JSON file in the pull request, as the backend reads it. */
export interface InFlightFileRead extends BaseFile {
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

/** A combined list, ALLPHOTOS.json, ALLALBUMS.json or ALLTAGS.json, read at one ref. */
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

/** ALLPHOTOS.json, ALLALBUMS.json, ALLTAGS.json, PLACES.json and LOCALIZATIONS.json, read at one ref. */
export interface CombinedFiles {
  photos: CombinedFile;
  albums: CombinedFile;
  tags: CombinedFile;
  places: CombinedFile;
  localizations: CombinedFile;
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
  albums: InFlightGroupsRead;
  tags: InFlightGroupsRead;
  places: InFlightGroupsRead;
  localizations: InFlightGroupsRead;
  images: InFlightImages;
}

/** The album, tag, place or localization files in the pull request, as the backend reads them. */
interface InFlightGroupsRead {
  folder: string;
  files: InFlightGroupFileRead[];
}

/** The photo data waiting in the pull request, checked against the combined lists at its head. */
export interface InFlightResponse extends Omit<
  InFlightRead,
  "files" | "albums" | "tags" | "places" | "localizations"
> {
  files: InFlightFile[];
  /** ALLPHOTOS.json at the pull request's head; not `found` when there is no pull request. */
  allPhotos: CombinedFile;
  /** The album, tag, place and localization files in the pull request. */
  albums: InFlightGroups;
  tags: InFlightGroups;
  places: InFlightGroups;
  localizations: InFlightGroups;
}

/** The album, tag, place or localization files in the pull request, and the combined file built from them. */
export interface InFlightGroups {
  folder: string;
  files: InFlightGroupFile[];
  /** ALLALBUMS.json, ALLTAGS.json, PLACES.json or LOCALIZATIONS.json; not `found` when there is no pull request. */
  all: CombinedFile;
}

/** One album, tag, place or localization file in the pull request, as the backend reads it. */
interface InFlightGroupFileRead extends BaseFile {
  path: string;
  status: string;
  fileUrl: string;
  data?: unknown;
  error?: string;
}

/** One album, tag, place or localization file in the pull request. */
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
  /** The commit that changed the file; empty when unchanged. */
  commitSha: string;
  /** False when the file already had this content, so nothing was committed. */
  changed: boolean;
  /** The photo data pull request, when saving a photo already in the portfolio opened it. */
  pullRequestUrl?: string;
  /** True when the save opened the pull request. */
  newPullRequest?: boolean;
}

/**
 * Replaces the content of a photo JSON file in the open photo data pull request, moving it to
 * `name` (without .json) in the same folder when that's given. A photo already in the portfolio
 * that the pull request doesn't change yet is saved into it, opening one when none is open.
 */
export const updateInFlightMutation = mutationOptions({
  mutationKey: ["photos", "in-flight", "update"],
  meta: {
    pushes: (result) => (result as UpdateResult).changed,
    changes: (result, variables, cached) => {
      const { path, data } = variables as { path: string; data: unknown };
      return [
        { kind: "photos", path: (result as UpdateResult).path, before: cached(path), after: data },
      ];
    },
  },
  mutationFn: (file: { path: string; data: unknown; name?: string }) =>
    requestJson<UpdateResult>("/api/photos/in-flight", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(file),
    }),
});

/** One photo JSON file on the base branch, a photo already in the portfolio. */
export interface PublishedFile extends InFlightFileRead {
  status: "published";
  /** The file's change status in the photo data pull request, such as `modified`, when it changes it. */
  inFlight?: string;
}

/** Every photo JSON file on the base branch, with each photo's image in R2. */
export interface PublishedResponse {
  repo: string;
  folder: string;
  /** The base branch the files were read from. */
  branch: string;
  /** Null when no pull request titled "Add photo data" is open. */
  pullRequest: InFlightPullRequest | null;
  files: PublishedFile[];
  images: InFlightImages;
}

/** The photos already in the portfolio, for the Gallery and for editing one on the Photo page. */
export const publishedPhotosQuery = queryOptions({
  queryKey: ["photos", "published"],
  queryFn: () => requestJson<PublishedResponse>("/api/photos/published"),
  retry: false,
});

/** What removing a photo JSON file did, including to its image in R2. */
export interface RemoveResult {
  path: string;
  /** The commit that removed the file. */
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
  meta: {
    pushes: true,
    changes: (_result, path, cached) => [
      { kind: "photos", path: path as string, before: cached(path as string), after: null },
    ],
  },
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

/**
 * Whether ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the photo data pull request have its
 * latest changes: `synced` when the newest commit to its data folder committed them, `stale` when
 * data changed after, and `none` with no pull request open.
 */
export interface CombinedStatus {
  state: "synced" | "stale" | "none";
  headSha?: string;
  /** The data files the pull request changed after the combined lists were last rebuilt, when stale. */
  pending?: PendingFile[];
}

/** A data file the photo data pull request changed that the combined lists don't have yet. */
export interface PendingFile {
  kind: keyof CombinedFiles;
  path: string;
  change: "added" | "modified" | "deleted";
}

/** The combined files' sync status, read once when the app starts; see `CombinedDataSync`. */
export const combinedStatusQuery = queryOptions({
  queryKey: ["photos", "combined", "status"],
  queryFn: () => requestJson<CombinedStatus>("/api/photos/combined/status"),
  retry: false,
  staleTime: Infinity,
});

/** What committing the combined files did. */
export interface CombinedCommit {
  /** False when they were already up to date and there were no edits, so nothing was committed. */
  changed: boolean;
  commitSha?: string;
  commitUrl?: string;
  /** The files the commit changed: the edited data files, then the combined files. */
  files: string[];
  /** How many data files the local edits changed. */
  edited: number;
  /** How many entries each has now. */
  counts: { photos: number; albums: number; tags: number };
  /** True when the commit opened the photo data pull request. */
  newPullRequest: boolean;
}

/** Top-level fields of one data file to set when committing, such as a photo's publish date. */
export interface FieldEdit {
  path: string;
  fields: Record<string, unknown>;
}

/**
 * Saves `edits` to their data files, rebuilds ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json from
 * every data file on the photo data pull request's branch and commits what changed, as one commit.
 */
export function commitCombined(edits: FieldEdit[]): Promise<CombinedCommit> {
  return requestJson<CombinedCommit>("/api/photos/combined", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ edits }),
  });
}

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
