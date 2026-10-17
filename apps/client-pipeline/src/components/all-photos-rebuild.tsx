import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  COMBINE_PENDING,
  type CombineStatus,
  combineState,
  combineStatusQuery,
} from "@/api/photos";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** About how long CI takes to rebuild ALLPHOTOS.json, for when its runs can't be read. */
const CI_REBUILD_MS = 30_000;

type CombineQuery = UseQueryResult<CombineStatus>;

const AMBER = "text-amber-700 dark:text-amber-400";

/** Per run state, the line to show unless the backend sent a message. */
const STATES: Record<CombineStatus["state"], { text: string; className: string }> = {
  waiting: {
    text: "Waiting for CI to rebuild ALLPHOTOS.json…",
    className: "text-muted-foreground",
  },
  running: { text: "CI is rebuilding ALLPHOTOS.json…", className: "text-muted-foreground" },
  done: { text: "CI rebuilt ALLPHOTOS.json.", className: "text-muted-foreground" },
  failed: { text: "CI couldn't rebuild ALLPHOTOS.json.", className: AMBER },
  unavailable: { text: "Couldn't check on CI.", className: AMBER },
};

/** Whether the "Combine photo data" run is known to be waiting to start or running. */
function isRebuilding(status: CombineQuery): boolean {
  return status.data !== undefined && COMBINE_PENDING.has(status.data.state);
}

/** Whether the runs can't be followed, so only a guess at CI's timing is left. */
function isUnavailable(status: CombineQuery): boolean {
  return status.isError || status.data?.state === "unavailable";
}

export interface RebuildWatch {
  status: CombineQuery;
  /** True while CI is about to rebuild, or rebuilding, ALLPHOTOS.json on the pull request. */
  rebuilding: boolean;
  /** Call after pushing to the pull request, so the new run is followed. */
  afterPush: () => void;
}

/**
 * Follows the "Combine photo data" run on the photo data pull request's head and calls `onRebuilt`
 * when a rebuild of ALLPHOTOS.json finishes. When the runs can't be read, it calls it about as
 * long as CI usually takes after each `afterPush` instead.
 */
export function useAllPhotosRebuild(enabled: boolean, onRebuilt: () => void): RebuildWatch {
  const queryClient = useQueryClient();
  const status = useQuery({ ...combineStatusQuery(), enabled });
  const rebuilding = isRebuilding(status);
  const unavailable = isUnavailable(status);
  const [pushes, setPushes] = useState(0);

  const onRebuiltRef = useRef(onRebuilt);
  useEffect(() => {
    onRebuiltRef.current = onRebuilt;
  });
  const wasRebuilding = useRef(false);
  useEffect(() => {
    if (wasRebuilding.current && !rebuilding) onRebuiltRef.current();
    wasRebuilding.current = rebuilding;
  }, [rebuilding]);
  useEffect(() => {
    if (pushes === 0 || !unavailable) return;
    const timer = setTimeout(() => onRebuiltRef.current(), CI_REBUILD_MS);
    return () => clearTimeout(timer);
  }, [pushes, unavailable]);

  const afterPush = () => {
    setPushes((n) => n + 1);
    void queryClient.invalidateQueries({ queryKey: combineStatusQuery().queryKey });
  };
  return { status, rebuilding, afterPush };
}

/** The line to show for status, and whether the run is still going. */
function rebuildLine(status: CombineQuery) {
  if (status.isError) return { text: status.error.message, className: AMBER, pending: false };
  const state = combineState(status.data);
  const { text, className } = STATES[state];
  return { text: status.data?.message ?? text, className, pending: COMBINE_PENDING.has(state) };
}

/** One line on where the ALLPHOTOS.json rebuild is, linked to its run once there is one. */
export function AllPhotosRebuild({ status }: { status: CombineQuery }) {
  const { text, className, pending } = rebuildLine(status);
  return (
    <p className={cn("flex items-center gap-2", className)}>
      {pending && <Spinner />}
      <span>
        {text} <RunLink url={status.data?.runUrl} />
      </span>
    </p>
  );
}

function RunLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      View run
    </a>
  );
}
