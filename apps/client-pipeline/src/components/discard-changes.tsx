import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { combinedStatusQuery, discardPending } from "@/api/photos";
import { useCombinedDataStore } from "@/stores/combined-data";
import { useInFlightBackupStore } from "@/stores/in-flight-backup";
import { useLocalEditsStore } from "@/stores/local-edits";

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/** The question Discard asks first. */
function question(localEdits: number, savedFiles: number): string {
  const parts = [
    savedFiles > 0 && plural(savedFiles, "saved file"),
    localEdits > 0 && `the edits to ${plural(localEdits, "image")}`,
  ].filter(Boolean);
  return `Discard ${parts.join(" and ")} waiting for Commit? GitHub never saw them, so they're gone for good.`;
}

/** Drops the changes the backend keeps, then has every page read its data again without them. */
async function discardSaved(queryClient: QueryClient) {
  await discardPending();
  useCombinedDataStore.getState().discarded();
  await rereadPending(queryClient);
}

/**
 * Has every page read its data again after the changes waiting for Commit changed other than by a
 * save, such as a discard or a restore from a backup.
 */
export async function rereadPending(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: combinedStatusQuery.queryKey });
  for (const area of ["photos", "publish", "data", "organize", "places"]) {
    void queryClient.invalidateQueries({ queryKey: [area] });
  }
}

/**
 * Drops everything waiting for Commit, after asking: the files saved in the app and the edits only
 * kept in the browser. Nothing on GitHub or in R2 changes.
 */
export function DiscardButton({
  localEdits,
  savedFiles,
}: {
  localEdits: number;
  savedFiles: number;
}) {
  const discardEdits = useLocalEditsStore((state) => state.discard);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  if (localEdits + savedFiles === 0) return null;
  const discard = async () => {
    if (!window.confirm(question(localEdits, savedFiles))) return;
    discardEdits();
    // Discarded for good, so the browser's copy goes too.
    useInFlightBackupStore.getState().clear();
    if (savedFiles === 0) return;
    await discardSaved(queryClient).catch((e: unknown) => setError(String(e)));
  };
  return (
    <button
      type="button"
      title={error}
      onClick={() => void discard()}
      className="text-muted-foreground underline underline-offset-4"
    >
      {error ? "Discard failed" : "Discard"}
    </button>
  );
}
