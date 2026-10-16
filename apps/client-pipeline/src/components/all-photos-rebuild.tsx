import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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

/**
 * Per run state: the line to show, unless the backend sent a message, and how long to wait before
 * refetching the pull request (none while the run hasn't finished).
 */
const STATES: Record<
  CombineStatus["state"],
  { text: string; className: string; refetchAfterMs?: number }
> = {
  waiting: {
    text: "Waiting for CI to rebuild ALLPHOTOS.json…",
    className: "text-muted-foreground",
  },
  running: { text: "CI is rebuilding ALLPHOTOS.json…", className: "text-muted-foreground" },
  done: {
    text: "CI rebuilt ALLPHOTOS.json.",
    className: "text-muted-foreground",
    refetchAfterMs: 0,
  },
  failed: { text: "CI couldn't rebuild ALLPHOTOS.json.", className: AMBER, refetchAfterMs: 0 },
  unavailable: {
    text: "Couldn't check on CI.",
    className: AMBER,
    refetchAfterMs: CI_REBUILD_MS,
  },
};

/** How long to wait before refetching; undefined while the run hasn't finished. */
function rebuildDelay(status: CombineQuery): number | undefined {
  if (status.isError) return CI_REBUILD_MS;
  return status.data && STATES[status.data.state].refetchAfterMs;
}

/**
 * Watches the "Combine photo data" run that rebuilds ALLPHOTOS.json after commit `sha` and calls
 * `onRebuilt` once it finishes. When the runs can't be read, it calls it after about as long as CI
 * usually takes instead.
 */
export function useAllPhotosRebuild(sha: string | undefined, onRebuilt: () => void): CombineQuery {
  const status = useQuery({ ...combineStatusQuery(sha), enabled: Boolean(sha) });
  const onRebuiltRef = useRef(onRebuilt);
  useEffect(() => {
    onRebuiltRef.current = onRebuilt;
  });
  const delay = rebuildDelay(status);
  useEffect(() => {
    if (!sha || delay === undefined) return;
    const timer = setTimeout(() => onRebuiltRef.current(), delay);
    return () => clearTimeout(timer);
  }, [sha, delay]);
  return status;
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
