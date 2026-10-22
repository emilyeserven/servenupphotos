import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { type InFlightRead, photosInFlightQuery } from "@/api/photos";
import { withCombined } from "@/lib/combined";
import { useCombinedData, useCombinedDataStore } from "@/stores/combined-data";

/**
 * The photo data pull request's files, checked against the combined lists the store keeps. When
 * the pull request has moved to a head the store didn't read them at, as after a merge or a push
 * from elsewhere, the store reads them again.
 */
export function useInFlight(enabled = true) {
  const combined = useCombinedData(enabled);
  const { data, error } = combined;
  const select = useCallback(
    (read: InFlightRead) => withCombined(read, { data, error }),
    [data, error],
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
