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
      places: changedFile(data.head.places, of("places")),
      localizations: changedFile(data.head.localizations, of("localizations")),
    },
  };
}

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/** How a file changed since the last commit, from its first and last change. */
type NetChange = "added" | "modified" | "deleted" | undefined;

/**
 * A file whose first change has no `before` was added since the last commit; one whose last change
 * removed it was deleted. Added and then deleted is no change at all.
 */
function netChange(first: FileChange, last: FileChange): NetChange {
  const added = !("before" in first);
  if (last.after === null) return added ? undefined : "deleted";
  return added ? "added" : "modified";
}

/** Each changed file's first and last change, by kind and path. */
function firstAndLast(changes: FileChange[]): Map<string, [FileChange, FileChange]> {
  const byPath = new Map<string, [FileChange, FileChange]>();
  for (const change of changes) {
    const key = `${change.kind}:${change.path}`;
    byPath.set(key, [byPath.get(key)?.[0] ?? change, change]);
  }
  return byPath;
}

/** What changed since the last commit, each file counted once. */
export interface PendingSummary {
  /** Images by how they changed. */
  images: Record<Exclude<NetChange, undefined>, number>;
  albums: number;
  tags: number;
  places: number;
  localizations: number;
  /** Saves whose files aren't known. */
  other: number;
}

/** The changes since the last commit, counted once per file. */
export function summarizeChanges(changes: FileChange[], unknownChanges: number): PendingSummary {
  const summary: PendingSummary = {
    images: { added: 0, modified: 0, deleted: 0 },
    albums: 0,
    tags: 0,
    places: 0,
    localizations: 0,
    other: unknownChanges,
  };
  for (const [first, last] of firstAndLast(changes).values()) {
    const net = netChange(first, last);
    if (!net) continue;
    if (first.kind === "photos") summary.images[net]++;
    else summary[first.kind]++;
  }
  return summary;
}

/** How many images changed in all, added, modified and deleted together. */
function imageCount(summary: PendingSummary): number {
  const { added, modified, deleted } = summary.images;
  return added + modified + deleted;
}

/** The counts that aren't 0, joined with commas. */
function nonZero(parts: [number, string][]): string {
  return parts
    .filter(([count]) => count > 0)
    .map(([count, word]) => plural(count, word))
    .join(", ");
}

/** The summary as the sync button says it, such as "3 images, 1 album"; "" with nothing known. */
export function pendingText(summary: PendingSummary): string {
  return nonZero([
    [imageCount(summary), "image"],
    [summary.albums, "album"],
    [summary.tags, "tag"],
    [summary.places, "place"],
    [summary.localizations, "localization"],
    [summary.other, "other save"],
  ]);
}
