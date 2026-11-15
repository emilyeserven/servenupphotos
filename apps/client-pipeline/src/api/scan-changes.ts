import { type CombinedKind, KIND_INFO } from "@/lib/data-kinds";

/**
 * Where a save went: into the changes waiting for Commit, which adds them to the open photo data
 * pull request, or opens one when none is open.
 */
export interface PendingSave {
  /** The open photo data pull request's branch; empty when Commit will open one. */
  branch: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  /** The files the save changed, before and after. */
  changes: ScanChange[];
}

/** A photo file a bulk save changed, as the backend answers: its data before and after. */
export interface ScanChange {
  path: string;
  before: unknown;
  after: unknown;
}

/**
 * The photo files a bulk save changed, as changes the combined data store makes over ALLPHOTOS.json
 * until it's committed.
 */
export function photoChanges(result: { changes?: ScanChange[] }) {
  return (result.changes ?? []).map((change) => ({ kind: "photos" as const, ...change }));
}

/**
 * The files a save changed, each as a `kind` file when its path is in that kind's folder (such as
 * "/tags/"), or else as a photo file.
 */
export function changesByFolder<K extends string>(result: PendingSave, kind: K) {
  return result.changes.map((change) => ({
    kind: change.path.includes(`/${kind}/`) ? kind : ("photos" as const),
    ...change,
  }));
}

/**
 * The files a save changed, each as the kind whose folder holds it (such as `.../likes/sam.json` as
 * "likes"), or else as a photo file.
 */
export function changesByKind(result: PendingSave) {
  return result.changes.map((change) => ({ kind: kindOfPath(change.path), ...change }));
}

/** The kind of combined data whose folder holds path, or "photos" when it isn't one of theirs. */
function kindOfPath(path: string): CombinedKind {
  const folder = path.split("/").at(-2) ?? "";
  return Object.hasOwn(KIND_INFO, folder) ? (folder as CombinedKind) : "photos";
}
