import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { type InFlightRead, photosInFlightQuery } from "@/api/photos";
import { withCombined } from "@/lib/combined";
import { useCombinedData, useCombinedDataStore } from "@/stores/combined-data";

/**
 * The photo data pull request's files, checked against the combined lists as GitHub has them, so
 * a file whose changes haven't been committed to them yet is marked as not synced. When the pull
 * request isn't the one the store read them for, as after a merge, the store reads them again.
 */
export function useInFlight(enabled = true) {
  const combined = useCombinedData(enabled);
  const { synced, error } = combined;
  const select = useCallback(
    (read: InFlightRead) => withCombined(read, { data: synced, error }),
    [synced, error],
  );
  const inFlight = useQuery({ ...photosInFlightQuery, enabled, select });

  const syncPullRequest = useCombinedDataStore((s) => s.syncPullRequest);
  const pullRequest = inFlight.isSuccess ? inFlight.data.pullRequest : undefined;
  const settled = combined.status === "ready" && !combined.fetching;
  useEffect(() => {
    if (settled && pullRequest !== undefined) syncPullRequest(pullRequest);
  }, [settled, pullRequest, syncPullRequest]);
  return inFlight;
}
