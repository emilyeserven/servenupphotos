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

/** Per run state, the line to show about a file unless the backend sent a message. */
const STATES: Record<
  CombineStatus["state"],
  { text: (file: string) => string; className: string }
> = {
  waiting: {
    text: (file) => `Waiting for CI to rebuild ${file}…`,
    className: "text-muted-foreground",
  },
  running: { text: (file) => `CI is rebuilding ${file}…`, className: "text-muted-foreground" },
  done: { text: (file) => `CI rebuilt ${file}.`, className: "text-muted-foreground" },
  failed: { text: (file) => `CI couldn't rebuild ${file}.`, className: AMBER },
  unavailable: { text: () => "Couldn't check on CI.", className: AMBER },
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
  /** The run doing the rebuild, or the workflow's runs page until GitHub starts it. */
  runUrl?: string;
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
  return { status, rebuilding, runUrl: runLink(status.data)?.url, afterPush };
}

/** The line to show for status, and whether the run is still going. */
function rebuildLine(status: CombineQuery, file: string) {
  if (status.isError) return { text: status.error.message, className: AMBER, pending: false };
  const state = combineState(status.data);
  const { text, className } = STATES[state];
  return {
    text: status.data?.message ?? text(file),
    className,
    pending: COMBINE_PENDING.has(state),
  };
}

/**
 * One line on where the rebuild of `file` (ALLPHOTOS.json unless named) is, linked to its run once
 * there is one. The same run rebuilds ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json.
 */
export function AllPhotosRebuild({
  status,
  file = "ALLPHOTOS.json",
}: {
  status: CombineQuery;
  file?: string;
}) {
  const { text, className, pending } = rebuildLine(status, file);
  return (
    <p className={cn("flex items-center gap-2", className)}>
      {pending && <Spinner />}
      <span>
        {text} <RunLink data={status.data} />
      </span>
    </p>
  );
}

/** data's run, or the workflow's runs page when GitHub hasn't started one yet. */
function runLink({ runUrl, runsUrl }: Partial<CombineStatus> = {}) {
  if (runUrl) return { url: runUrl, label: "View run" };
  return runsUrl ? { url: runsUrl, label: "View runs" } : undefined;
}

function RunLink({ data }: { data?: CombineStatus }) {
  const link = runLink(data);
  if (!link) return null;
  return (
    <a href={link.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {link.label}
    </a>
  );
}
