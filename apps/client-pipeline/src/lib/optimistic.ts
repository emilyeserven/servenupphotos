import type { QueryClient } from "@tanstack/react-query";
import {
  type CombinedData,
  type PendingFile,
  type CombinedFile,
  type CombinedFiles,
  type InFlightPullRequest,
  type InFlightRead,
  photosInFlightQuery,
  type PublishedResponse,
  publishedPhotosQuery,
} from "@/api/photos";
import { canonicalJson } from "@/lib/combined";
import { isDraft } from "@/lib/drafts";

/**
 * One file a save changed, waiting for Commit, which the combined lists won't have until it's
 * committed. `before` is the file's data before the save, when known, so its old entry can be
 * replaced; `after` is null when the save removed the file.
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
  if (!read) return [];
  const groups = [
    read.albums,
    read.tags,
    read.places,
    read.localizations,
    read.metainfo,
    read.cameras,
  ];
  return [...read.files, ...groups.flatMap((group) => group.files)];
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
 * The photo changes as they change ALLPHOTOS.json: a photo saved without a title is left out, as a
 * draft, unless untitled photos are included.
 */
function photoChanges(changes: FileChange[], includeUntitled = false): FileChange[] {
  if (includeUntitled) return changes;
  return changes.map((change) => (isDraft(change.after) ? { ...change, after: null } : change));
}

/**
 * Stands in for the pull request Commit will open when none is open, so the changes waiting for it
 * show over the base branch's lists. Its number, 0, is never a real pull request's.
 */
const WAITING_FOR_COMMIT: InFlightPullRequest = {
  number: 0,
  title: "Add photo data",
  url: "",
  branch: "",
  headSha: "",
};

/** The lists Commit starts from: at the pull request's head, or the base branch's with none open. */
function headOf(data: CombinedData): NonNullable<CombinedData["head"]> {
  return data.head ?? { ...data.base, pullRequest: WAITING_FOR_COMMIT };
}

/**
 * data with changes made to the combined lists at the pull request's head, as they'll be once
 * committed; with no pull request open, `head` is the base branch's lists with them made, under
 * `WAITING_FOR_COMMIT`. The base branch's are left as they are, since nothing has merged. A file
 * that couldn't be read is left as it is, and a draft is taken out of ALLPHOTOS.json.
 */
export function withChanges(data: CombinedData, changes: FileChange[]): CombinedData {
  if (changes.length === 0) return data;
  const head = headOf(data);
  const of = (kind: keyof CombinedFiles) => changes.filter((change) => change.kind === kind);
  return {
    ...data,
    head: {
      ...head,
      photos: changedFile(head.photos, photoChanges(of("photos"), data.includeUntitled)),
      albums: changedFile(head.albums, of("albums")),
      tags: changedFile(head.tags, of("tags")),
      places: changedFile(head.places, of("places")),
      localizations: changedFile(head.localizations, of("localizations")),
      metainfo: changedFile(head.metainfo, of("metainfo")),
      cameras: changedFile(head.cameras, of("cameras")),
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

/**
 * How a file changed since the last commit when GitHub listed it as changed at `checked` when the
 * app started, and the app changed it again since: GitHub knows whether it was added before.
 */
function netAfterChecked(checked: PendingFile["change"], last: FileChange): NetChange {
  if (last.after === null) return checked === "added" ? undefined : "deleted";
  return checked === "deleted" ? "modified" : checked;
}

function fileKey({ kind, path }: { kind: string; path: string }): string {
  return `${kind}:${path}`;
}

/** Each changed file's first and last change, by kind and path. */
function firstAndLast(changes: FileChange[]): Map<string, [FileChange, FileChange]> {
  const byPath = new Map<string, [FileChange, FileChange]>();
  for (const change of changes) {
    const key = fileKey(change);
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
  metainfo: number;
  cameras: number;
  /** Saves whose files aren't known. */
  other: number;
}

/** Counts a file that changed in the way net, if it did. */
function count(summary: PendingSummary, kind: keyof CombinedFiles, net: NetChange) {
  if (!net) return;
  if (kind === "photos") summary.images[net]++;
  else summary[kind]++;
}

/**
 * The changes since the last commit, counted once per file: the files GitHub listed as changed
 * when the app started (`checked`), and the app's own changes since.
 */
export function summarizeChanges(
  changes: FileChange[],
  unknownChanges: number,
  checked: PendingFile[] = [],
): PendingSummary {
  const summary: PendingSummary = {
    images: { added: 0, modified: 0, deleted: 0 },
    albums: 0,
    tags: 0,
    places: 0,
    localizations: 0,
    metainfo: 0,
    cameras: 0,
    other: unknownChanges,
  };
  const byKey = new Map(checked.map((file) => [fileKey(file), file]));
  for (const [key, [first, last]] of firstAndLast(changes)) {
    const before = byKey.get(key);
    byKey.delete(key);
    count(
      summary,
      first.kind,
      before ? netAfterChecked(before.change, last) : netChange(first, last),
    );
  }
  for (const file of byKey.values()) count(summary, file.kind, file.change);
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
    [summary.metainfo, "metadata group"],
    [summary.cameras, "camera override"],
    [summary.other, "other save"],
  ]);
}
