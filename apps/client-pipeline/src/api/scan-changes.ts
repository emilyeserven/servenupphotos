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
