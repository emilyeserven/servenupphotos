import { requestJson } from "@/api/settings";
import type { LocalEdit } from "@/stores/local-edits";

/** One data file waiting for Commit: its data as saved, or `deleted` when the change removes it. */
export interface BackupFile {
  path: string;
  data?: unknown;
  deleted?: boolean;
  /** When it was last saved, as an ISO time. */
  saved: string;
}

/** Every change waiting for Commit that the backend keeps, for one repository. */
export interface InFlightBackup {
  version: number;
  repo: string;
  /** When the backup was made, as an ISO time. */
  exported: string;
  files: BackupFile[];
}

/**
 * All the in-flight work, as an exported file has it: the backend's changes waiting for Commit and
 * the edits only kept in the browser, such as Instagram dates.
 */
export interface InFlightWork extends InFlightBackup {
  localEdits: Record<string, LocalEdit>;
}

/** How many files a restore kept as changes waiting for Commit, and how many were already so. */
export interface RestoreResult {
  restored: number;
  unchanged: number;
}

/** The backend's changes waiting for Commit; it reads nothing from GitHub, so it works offline. */
export function exportPending(): Promise<InFlightBackup> {
  return requestJson<InFlightBackup>("/api/photos/pending");
}

/** Keeps the files in backup as changes waiting for Commit, as saves would. */
export function importPending(backup: InFlightBackup): Promise<RestoreResult> {
  const { version, repo, exported, files } = backup;
  return requestJson<RestoreResult>("/api/photos/pending", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version, repo, exported, files }),
  });
}

/** How many changes work holds: the files waiting for Commit and the photos with browser-only edits. */
export function workCount(work: InFlightWork): number {
  return work.files.length + Object.keys(work.localEdits).length;
}

/** The file name an export of work gets, with the time it was made: in-flight-work-2026-10-30T06-44-08Z.json. */
export function exportFileName(work: InFlightWork): string {
  const stamp = new Date(work.exported)
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replaceAll(":", "-");
  return `in-flight-work-${stamp}.json`;
}

/** text, a file the user picked, as in-flight work, or an error saying why it isn't. */
export function parseWork(text: string): InFlightWork {
  const parsed = JSON.parse(text) as Partial<InFlightWork>;
  if (typeof parsed.repo !== "string" || !Array.isArray(parsed.files)) {
    throw new Error("That file isn't an in-flight work export.");
  }
  return { ...(parsed as InFlightBackup), localEdits: parsed.localEdits ?? {} };
}
