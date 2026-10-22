import { type UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  COMBINE_PENDING,
  type CombineStatus,
  combineState,
  combineStatusQuery,
  startRebuildMutation,
} from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useCombinedDataStore, useCombinedSync } from "@/stores/combined-data";

type CombineQuery = UseQueryResult<CombineStatus>;

const AMBER = "text-amber-700 dark:text-amber-400";

/** Per run state, the line to show about a file unless the backend sent a message. */
const STATES: Record<
  CombineStatus["state"],
  { text: (file: string) => string; className: string }
> = {
  stale: {
    text: (file) => `Not synced: ${file} doesn't have the latest changes yet.`,
    className: AMBER,
  },
  waiting: {
    text: (file) => `Waiting for CI to rebuild ${file}…`,
    className: "text-muted-foreground",
  },
  running: { text: (file) => `CI is rebuilding ${file}…`, className: "text-muted-foreground" },
  done: { text: (file) => `${file} is up to date.`, className: "text-muted-foreground" },
  failed: { text: (file) => `CI couldn't rebuild ${file}.`, className: AMBER },
  unavailable: { text: () => "Couldn't check on CI.", className: AMBER },
};

export interface RebuildWatch {
  /** The rebuild started from Photos in Flight, while one is going. */
  status: CombineQuery;
  /** True while CI is about to rebuild, or rebuilding, ALLPHOTOS.json on the pull request. */
  rebuilding: boolean;
  /** The run doing the rebuild, or the workflow's runs page until GitHub starts it. */
  runUrl?: string;
  /**
   * Pushes no longer start a rebuild, so there's nothing to follow after one; the combined data
   * store notes each push itself. Kept so pages can still call it.
   */
  afterPush: () => void;
}

/** Calls onRebuilt each time rebuilding goes from true to false. */
function useOnRebuilt(rebuilding: boolean, onRebuilt: () => void) {
  const onRebuiltRef = useRef(onRebuilt);
  useEffect(() => {
    onRebuiltRef.current = onRebuilt;
  });
  const wasRebuilding = useRef(false);
  useEffect(() => {
    if (wasRebuilding.current && !rebuilding) onRebuiltRef.current();
    wasRebuilding.current = rebuilding;
  }, [rebuilding]);
}

/**
 * Follows the rebuild of ALLPHOTOS.json started from Photos in Flight, which the combined data
 * store keeps, and calls `onRebuilt` when it finishes.
 */
export function useAllPhotosRebuild(enabled: boolean, onRebuilt: () => void): RebuildWatch {
  const started = useCombinedDataStore((s) => s.rebuild?.status);
  const rebuilding = enabled && started !== undefined;
  const sha = rebuilding ? started.sha : undefined;
  // The same query CombinedDataSync follows the run with, so it's polled once.
  const status = useQuery({ ...combineStatusQuery(sha), enabled: rebuilding });
  useOnRebuilt(rebuilding, onRebuilt);
  return { status, rebuilding, runUrl: followedRunUrl(status.data, started), afterPush: () => {} };
}

/** The followed run's page, or the workflow's runs page until GitHub starts it. */
function followedRunUrl(data: CombineStatus | undefined, started: CombineStatus | undefined) {
  if (!started) return undefined;
  return runLink(data ?? started)?.url;
}

interface Line {
  text: string;
  className: string;
  pending: boolean;
}

function stateLine(state: CombineStatus["state"], file: string, message?: string): Line {
  const { text, className } = STATES[state];
  return { text: message ?? text(file), className, pending: COMBINE_PENDING.has(state) };
}

/** The line to show for a rebuild that's going, and whether it is still going. */
function rebuildLine(status: CombineQuery, started: CombineStatus, file: string): Line {
  if (status.isError) return { text: status.error.message, className: AMBER, pending: false };
  const data = status.data ?? started;
  return stateLine(combineState(data), file, data.message);
}

type Sync = ReturnType<typeof useCombinedSync>;

/** The line to show while nothing is rebuilding: whether file has every change pushed. */
function syncLine(sync: Sync, file: string): Line {
  return stateLine(sync.unsynced ? "stale" : (sync.headState ?? "done"), file);
}

/**
 * One line on whether `file` (ALLPHOTOS.json unless named) has the changes pushed to the pull
 * request: where its rebuild is while one is going, linked to its run, or else whether it's synced,
 * with a link to Photos in Flight to rebuild it when it isn't. The same run rebuilds
 * ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json.
 */
export function AllPhotosRebuild({
  status,
  file = "ALLPHOTOS.json",
}: {
  status: CombineQuery;
  file?: string;
}) {
  const sync = useCombinedSync();
  const { text, className, pending } = sync.rebuild
    ? rebuildLine(status, sync.rebuild, file)
    : syncLine(sync, file);
  return (
    <p className={cn("flex items-center gap-2", className)}>
      {pending && <Spinner />}
      <span>
        {text} <LineLink sync={sync} data={status.data} />
      </span>
    </p>
  );
}

/** The run while one is going, or else a link to Photos in Flight to start one when it's needed. */
function LineLink({ sync, data }: { sync: Sync; data?: CombineStatus }) {
  if (sync.rebuild) return <RunLink data={data ?? sync.rebuild} />;
  if (!sync.unsynced) return null;
  return (
    <Link to="/in-flight" className="underline underline-offset-4">
      Rebuild it from Photos in Flight
    </Link>
  );
}

/**
 * Starts the rebuild of ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the photo data pull
 * request, which the combined data store then follows.
 */
export function RebuildButton() {
  const sync = useCombinedSync();
  const rebuildStarted = useCombinedDataStore((s) => s.rebuildStarted);
  const start = useMutation({ ...startRebuildMutation, onSuccess: rebuildStarted });
  const busy = start.isPending || sync.rebuilding;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={sync.unsynced ? "default" : "outline"}
        disabled={busy}
        onClick={() => start.mutate()}
        title="Rebuild ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the pull request"
      >
        <RebuildIcon busy={busy} />
        Rebuild
      </Button>
      <StartError error={start.error} />
    </div>
  );
}

function RebuildIcon({ busy }: { busy: boolean }) {
  return busy ? <Spinner /> : <RefreshCwIcon />;
}

function StartError({ error }: { error: Error | null }) {
  if (!error) return null;
  return <p className="text-destructive text-xs">{error.message}</p>;
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
