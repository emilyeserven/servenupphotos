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

/** Where a photo's data was saved: as a change waiting for Commit, nothing on GitHub yet. */
export interface PublishResult {
  path: string;
  /** The open photo data pull request Commit will add it to; unset when Commit will open one. */
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  /** The JSON saved. */
  data: unknown;
}

export const publishPhotoMutation = mutationOptions({
  mutationKey: ["photos", "github"],
  meta: {
    saves: true,
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
  /** The file's page on GitHub; empty while it has changes waiting for Commit. */
  fileUrl: string;
  /** Whether the file has changes waiting for Commit. */
  pending?: boolean;
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
  /** METAINFO.json, the metadata groups. */
  metainfo: CombinedFile;
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
 * with each page; see `useCombinedData`. The backend reads GitHub once when it starts and answers
 * from that, to spare GitHub's rate limit; `refresh` makes it ask GitHub again, so every read
 * after it sees a merge or a push made on GitHub.
 */
export function readCombinedData(refresh = false): Promise<CombinedData> {
  return requestJson<CombinedData>(`/api/photos/combined${refresh ? "?refresh=1" : ""}`);
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
  /** The metadata group files, combined into METAINFO.json. */
  metainfo: InFlightGroupsRead;
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
  "files" | "albums" | "tags" | "places" | "localizations" | "metainfo"
> {
  files: InFlightFile[];
  /** ALLPHOTOS.json at the pull request's head; not `found` when there is no pull request. */
  allPhotos: CombinedFile;
  /** The album, tag, place, localization and metadata group files in the pull request. */
  albums: InFlightGroups;
  tags: InFlightGroups;
  places: InFlightGroups;
  localizations: InFlightGroups;
  metainfo: InFlightGroups;
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
  /** The file's page on GitHub; empty while it has changes waiting for Commit. */
  fileUrl: string;
  /** Whether the file has changes waiting for Commit. */
  pending?: boolean;
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

/**
 * The photo data pull request's files and the changes waiting for Commit; `useInFlight` checks them
 * against the combined lists.
 */
export const photosInFlightQuery = queryOptions({
  queryKey: ["photos", "in-flight"],
  queryFn: () => requestJson<InFlightRead>("/api/photos/in-flight"),
  retry: false,
});

/** What saving an edit of a photo JSON file did. */
export interface UpdateResult {
  path: string;
  /** False when the file already had this content, so nothing was saved. */
  changed: boolean;
  /** The photo data pull request Commit will add it to; unset when Commit will open one. */
  pullRequestUrl?: string;
  /** The file's data before, at its old path when renamed; null when it's new. */
  before: unknown;
}

/**
 * Saves new content for a photo JSON file as a change waiting for Commit, moving it to `name`
 * (without .json) in the same folder when that's given. A photo already in the portfolio can be
 * edited too; Commit adds the change to the photo data pull request, opening one when none is open.
 */
export const updateInFlightMutation = mutationOptions({
  mutationKey: ["photos", "in-flight", "update"],
  meta: {
    saves: (result) => (result as UpdateResult).changed,
    changes: (result, variables) => {
      const { data } = variables as { path: string; data: unknown };
      const { path, before } = result as UpdateResult;
      return [{ kind: "photos", path, ...(before === null ? {} : { before }), after: data }];
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

/** What removing a photo JSON file waiting for Commit did, including to its image in R2. */
export interface RemoveResult {
  path: string;
  /** The file's data before it was removed. */
  before: unknown;
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
    saves: true,
    changes: (result, path) => [
      {
        kind: "photos",
        path: path as string,
        before: (result as RemoveResult).before,
        after: null,
      },
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
 * Whether ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the photo data pull request have every
 * change: `synced` when they do, `stale` when changes are waiting for Commit or data files were
 * committed without rebuilding them, and `none` with no pull request open and nothing waiting.
 */
export interface CombinedStatus {
  state: "synced" | "stale" | "none";
  headSha?: string;
  /** The data files the combined lists don't have yet, when stale. */
  pending?: PendingFile[];
  /**
   * The changes waiting for Commit, kept by the backend so they survive a reload: each file's data
   * at the pull request's head (null when it isn't there) and as saved (null when removed).
   */
  changes?: { kind: keyof CombinedFiles; path: string; before: unknown; after: unknown }[];
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

/** What committing the changes waiting for Commit and the combined files did. */
export interface CombinedCommit {
  /** False when nothing was waiting and the lists were up to date, so nothing was committed. */
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
  /** The photo data pull request the commit went to. */
  pullRequestUrl?: string;
}

/** Top-level fields of one data file to set when committing, such as a photo's publish date. */
export interface FieldEdit {
  path: string;
  fields: Record<string, unknown>;
}

/**
 * Commits every change waiting for Commit and `edits` to their data files, with ALLPHOTOS.json,
 * ALLALBUMS.json and ALLTAGS.json rebuilt from the result, as one commit on the photo data pull
 * request's branch, opening the pull request when none is open. This is the app's only write to
 * GitHub's photo data.
 */
export function commitCombined(edits: FieldEdit[]): Promise<CombinedCommit> {
  return requestJson<CombinedCommit>("/api/photos/combined", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ edits }),
  });
}

/** How many changes waiting for Commit were dropped. */
interface DiscardResult {
  discarded: number;
}

/** Drops every change waiting for Commit. Nothing on GitHub or in R2 changes. */
export function discardPending(): Promise<DiscardResult> {
  return requestJson<DiscardResult>("/api/photos/pending", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: "{}",
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
