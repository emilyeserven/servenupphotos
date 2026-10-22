import type { QueryClient } from "@tanstack/react-query";
import {
  type CombinedData,
  type CombinedFile,
  type CombinedFiles,
  type InFlightRead,
  photosInFlightQuery,
  type PublishedResponse,
  publishedPhotosQuery,
} from "@/api/photos";
import { canonicalJson } from "@/lib/combined";

/**
 * One file a push changed in the photo data pull request, which the combined lists won't have
 * until they're committed. `before` is the file's data before the push, when known, so its old entry
 * can be replaced; `after` is null when the push removed the file.
 */
export interface FileChange {
  kind: keyof CombinedFiles;
  path: string;
  before?: unknown;
  after: unknown;
}

interface CachedFile {
  path: string;
  data?: unknown;
}

function inFlightFiles(read: InFlightRead | undefined): CachedFile[] {
  return read ? [...read.files, ...read.albums.files, ...read.tags.files] : [];
}

function publishedFiles(read: PublishedResponse | undefined): CachedFile[] {
  return read ? read.files : [];
}

/** The data the pages last read for the photo, album or tag file at path, if any did. */
export function cachedFile(queryClient: QueryClient, path: string): unknown {
  const files = [
    ...inFlightFiles(queryClient.getQueryData<InFlightRead>(photosInFlightQuery.queryKey)),
    ...publishedFiles(queryClient.getQueryData<PublishedResponse>(publishedPhotosQuery.queryKey)),
  ];
  return files.find((file) => file.path === path)?.data;
}

/** Where the entry equal to before (ignoring key order) is in list; -1 when it isn't, or unknown. */
function indexOf(list: unknown[], before: unknown): number {
  if (before === undefined) return -1;
  const old = canonicalJson(before);
  return list.findIndex((entry) => canonicalJson(entry) === old);
}

/** list with change made: its old entry replaced by its new one, or the new one added at the end. */
function changedEntry(list: unknown[], { before, after }: FileChange): unknown[] {
  const at = indexOf(list, before);
  if (at === -1) return after === null ? list : [...list, after];
  return after === null ? list.toSpliced(at, 1) : list.toSpliced(at, 1, after);
}

/** entries with each change made in turn. */
function changedEntries(entries: unknown[], changes: FileChange[]): unknown[] {
  return changes.reduce(changedEntry, entries);
}

function changedFile(file: CombinedFile, changes: FileChange[]): CombinedFile {
  if (changes.length === 0 || !file.data) return file;
  const data = changedEntries(file.data, changes);
  return { ...file, data, count: data.length };
}

/**
 * data with changes made to the combined lists at the pull request's head, as they'll be
 * once committed. The base branch's are left as they are, since the pull request hasn't
 * merged. A file that couldn't be read is left as it is.
 */
export function withChanges(data: CombinedData, changes: FileChange[]): CombinedData {
  if (!data.head || changes.length === 0) return data;
  const of = (kind: keyof CombinedFiles) => changes.filter((change) => change.kind === kind);
  return {
    ...data,
    head: {
      ...data.head,
      photos: changedFile(data.head.photos, of("photos")),
      albums: changedFile(data.head.albums, of("albums")),
      tags: changedFile(data.head.tags, of("tags")),
    },
  };
}

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/**
 * The files changed since the last commit, counted once each, as "2 images, 1 album", with saves
 * whose files aren't known as "other saves"; "" with none.
 */
export function pendingText(changes: FileChange[], unknownChanges: number): string {
  const paths = { photos: new Set<string>(), albums: new Set<string>(), tags: new Set<string>() };
  for (const change of changes) paths[change.kind].add(change.path);
  const parts = [
    plural(paths.photos.size, "image"),
    plural(paths.albums.size, "album"),
    plural(paths.tags.size, "tag"),
    plural(unknownChanges, "other save"),
  ];
  return parts.filter((part) => !part.startsWith("0 ")).join(", ");
}
