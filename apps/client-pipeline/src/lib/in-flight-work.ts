import type { QueryClient } from "@tanstack/react-query";
import {
  type InFlightWork,
  type RestoreResult,
  exportPending,
  exportFileName,
  importPending,
  workCount,
} from "@/api/backup";
import { rereadPending } from "@/components/discard-changes";
import { useInFlightBackupStore } from "@/stores/in-flight-backup";
import { useLocalEditsStore } from "@/stores/local-edits";

/** All the in-flight work now: the backend's changes waiting for Commit and the browser-only edits. */
export async function currentWork(): Promise<InFlightWork> {
  const backup = await exportPending();
  return { ...backup, localEdits: useLocalEditsStore.getState().edits };
}

/**
 * Copies the in-flight work to the browser. An empty copy never replaces one with changes, unless
 * `settled` says everything was just committed while online, which drops the copy instead. When the
 * backend can't be reached, the last copy stays.
 */
export async function keepWork(settled = false) {
  const work = await currentWork().catch(() => undefined);
  if (work) keepCopy(work, settled);
}

/** Keeps work in the browser, or drops the copy when it's empty and `settled` while online. */
function keepCopy(work: InFlightWork, settled: boolean) {
  const store = useInFlightBackupStore.getState();
  if (workCount(work) > 0) store.keep(work);
  else if (settled && navigator.onLine) store.clear();
}

/** Saves work as a JSON file named with the time it was exported. */
export function downloadWork(work: InFlightWork) {
  const blob = new Blob([`${JSON.stringify(work, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(work);
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Puts work back: its files as changes waiting for Commit, over any waiting for the same files, and
 * its browser-only edits, then has every page read its data again.
 */
export async function restoreWork(
  work: InFlightWork,
  queryClient: QueryClient,
): Promise<RestoreResult> {
  const result = work.files.length > 0 ? await importPending(work) : { restored: 0, unchanged: 0 };
  useLocalEditsStore.getState().imported(work.localEdits);
  await rereadPending(queryClient);
  return result;
}
