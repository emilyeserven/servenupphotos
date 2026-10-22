import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  COMBINE_PENDING,
  type CombineStatus,
  combineState,
  combineStatusQuery,
} from "@/api/photos";
import { type SettingsResponse, settingsQuery } from "@/api/settings";
import { useCombinedDataStore } from "@/stores/combined-data";

/** About how long CI takes to rebuild ALLPHOTOS.json, for when its runs can't be read. */
const CI_REBUILD_MS = 30_000;

function isGitHubSetUp(settings: SettingsResponse | undefined): boolean {
  return Boolean(settings?.github.repo && settings.github.token.set);
}

/**
 * Checks once, when the app starts, whether ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json are
 * rebuilt at the photo data pull request's head, then follows only the rebuilds started from
 * Photos in Flight, so the combined data store reads them again once one finishes. Renders nothing.
 */
export function CombinedDataSync() {
  const settings = useQuery(settingsQuery);
  if (!isGitHubSetUp(settings.data)) return null;
  return (
    <>
      <HeadCheck />
      <RebuildFollower />
    </>
  );
}

function isPending(status: CombineStatus): boolean {
  return COMBINE_PENDING.has(combineState(status));
}

/**
 * Notes the head's status in the store, and has it read the lists again when a run that was
 * going, such as one started from the Actions tab, has ended.
 */
function noteHead(status: CombineStatus, wasPending: boolean) {
  const store = useCombinedDataStore.getState();
  store.headChecked(status);
  if (wasPending && !isPending(status) && store.status === "ready") void store.refresh();
}

/** Checks the pull request's head once, following a run that's already going until it ends. */
function HeadCheck() {
  const { data } = useQuery({ ...combineStatusQuery(), staleTime: Infinity });
  const wasPending = useRef(false);
  useEffect(() => {
    if (!data) return;
    noteHead(data, wasPending.current);
    wasPending.current = isPending(data);
  }, [data]);
  return null;
}

/** Whether a followed run has ended, so it can be noted; not when it can't be read. */
function hasEnded(status: CombineStatus | undefined): status is CombineStatus {
  return status !== undefined && !isPending(status) && status.state !== "unavailable";
}

/** Follows the rebuild started from Photos in Flight until it finishes. */
function RebuildFollower() {
  const started = useCombinedDataStore((s) => s.rebuild?.status);
  const run = useQuery({ ...combineStatusQuery(started?.sha), enabled: started !== undefined });
  useEffect(() => {
    if (hasEnded(run.data)) useCombinedDataStore.getState().rebuildFinished(run.data);
  }, [run.data]);
  // Without Actions read access, the run can't be followed: guess at when it's done.
  const unavailable = run.isError || run.data?.state === "unavailable";
  useEffect(() => {
    if (!started || !unavailable) return;
    const finish = () =>
      useCombinedDataStore.getState().rebuildFinished({ ...started, state: "unavailable" });
    const timer = setTimeout(finish, CI_REBUILD_MS);
    return () => clearTimeout(timer);
  }, [started, unavailable]);
  return null;
}
