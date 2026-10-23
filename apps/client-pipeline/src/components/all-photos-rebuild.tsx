import { type UseQueryResult, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCommitHorizontalIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { type CombinedStatus, combinedStatusQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useCombinedSync } from "@/stores/combined-data";

type StatusQuery = UseQueryResult<CombinedStatus>;

export interface RebuildWatch {
  /** Whether the combined files were synced when the app started. */
  status: StatusQuery;
  /** True while ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json are being committed. */
  rebuilding: boolean;
  /** The last commit of them, once there is one. */
  runUrl?: string;
  /**
   * Saves don't rebuild the combined files, and the combined data store notes each save itself,
   * so there's nothing to do after one. Kept so pages can still call it.
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
 * Follows the commits of ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json, which the combined data
 * store makes, and calls `onRebuilt` when one finishes.
 */
export function useAllPhotosRebuild(enabled: boolean, onRebuilt: () => void): RebuildWatch {
  const sync = useCombinedSync();
  // Read once when the app starts; this only shares it.
  const status = useQuery({ ...combinedStatusQuery, enabled });
  const rebuilding = enabled && sync.committing;
  useOnRebuilt(rebuilding, onRebuilt);
  return { status, rebuilding, runUrl: sync.lastCommit?.commitUrl, afterPush: () => {} };
}

/**
 * One line on whether `file` (ALLPHOTOS.json unless named) has every change, with a button to
 * commit when it doesn't. One commit has the changes waiting for Commit, ALLPHOTOS.json,
 * ALLALBUMS.json and ALLTAGS.json.
 */
export function AllPhotosRebuild({
  file = "ALLPHOTOS.json",
}: {
  /** Kept so pages can still pass it; the line reads the combined data store. */
  status?: StatusQuery;
  file?: string;
}) {
  const sync = useCombinedSync();
  if (sync.committing) {
    return (
      <p className="text-muted-foreground flex items-center gap-2">
        <Spinner />
        Committing {file}…
      </p>
    );
  }
  if (sync.commitError) {
    return (
      <p className="text-destructive">
        Couldn&apos;t commit {file}: {sync.commitError.message}
      </p>
    );
  }
  if (!sync.unsynced) return <p className="text-muted-foreground">{file} is up to date.</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-amber-700 dark:text-amber-400">
      Not synced: changes are waiting for Commit, and {file} doesn&apos;t have them yet.
      <CommitButton variant="link" />
    </p>
  );
}

/**
 * Commits every change waiting for Commit and the app's local edits, such as Instagram dates, with
 * ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json rebuilt, as one commit to the photo data pull
 * request, opening one when none is open. It's the only button that writes photo data to GitHub.
 * Afterwards the pages read the files again, since the commit changed them.
 */
export function CommitButton({
  variant = "default",
}: {
  variant?: "default" | "outline" | "link";
}) {
  const { committing, commit } = useCombinedSync();
  const queryClient = useQueryClient();
  const commitAndReread = async () => {
    await commit();
    // Saved files now have pages on GitHub, so every page that lists them reads them again.
    for (const area of ["photos", "publish", "data", "organize", "places"]) {
      void queryClient.invalidateQueries({ queryKey: [area] });
    }
  };
  const link = variant === "link";
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={committing}
      onClick={() => void commitAndReread()}
      title="Send every change waiting for Commit to GitHub, with ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json rebuilt, as one commit to the pull request"
      className={cn(link && "h-auto p-0 text-inherit underline")}
    >
      <CommitIcon busy={committing} hidden={link} />
      Commit
    </Button>
  );
}

function CommitIcon({ busy, hidden }: { busy: boolean; hidden: boolean }) {
  if (hidden) return null;
  return busy ? <Spinner /> : <GitCommitHorizontalIcon />;
}
