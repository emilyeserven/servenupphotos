import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleDotIcon, GitPullRequestIcon, TriangleAlertIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import type { CombinedCommit } from "@/api/photos";
import { githubIsSetUp, settingsQuery } from "@/api/settings";
import { CommitButton } from "@/components/all-photos-rebuild";
import { CommitError } from "@/components/commit-error";
import { DiscardButton } from "@/components/discard-changes";
import { UploadProgressBadge, UploadQueueSection } from "@/components/bulk-upload/upload-progress";
import { Spinner } from "@/components/ui/spinner";
import { FloatingActionsSlot } from "@/components/floating-actions";
import { InFlightBackupSection } from "@/components/in-flight-backup";
import { NextUntitledPhoto } from "@/components/next-untitled-photo";
import { SkippedEdits } from "@/components/skipped-edits";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/utils";
import { useCombinedData, useCombinedSync } from "@/stores/combined-data";

type Sync = ReturnType<typeof useCombinedSync>;

/** What the floating button says, and how it looks. */
interface Badge {
  icon: ReactNode;
  label: string;
  className: string;
}

const MUTED = "text-muted-foreground";
const AMBER = "text-amber-700 dark:text-amber-400";

function unsyncedBadge(sync: Sync): Badge {
  const label = sync.pending ? `Not synced · ${sync.pending}` : "Not synced";
  return { icon: <CircleDotIcon />, label, className: AMBER };
}

type Settled = "checking" | "none" | "synced";

const SETTLED: Record<Settled, Badge> = {
  checking: { icon: <Spinner />, label: "Checking…", className: MUTED },
  // Synced, and no batch (photo data pull request) is open: nothing is waiting anywhere.
  none: {
    icon: <CheckIcon />,
    label: "Synced · no open batch",
    className: "text-emerald-700 dark:text-emerald-400",
  },
  // Synced, but the batch is still open, waiting to be merged.
  synced: {
    icon: <GitPullRequestIcon />,
    label: "Synced · batch open",
    className: "text-sky-700 dark:text-sky-400",
  },
};

const COMMITTING: Badge = { icon: <Spinner />, label: "Committing…", className: MUTED };
const FAILED: Badge = {
  icon: <TriangleAlertIcon />,
  label: "Commit failed",
  className: "text-destructive",
};

/** Which settled badge shows, when nothing is committing or unsynced. */
function settledKey(sync: Sync, loading: boolean): Settled {
  if (loading) return "checking";
  return sync.pullRequest ? "synced" : "none";
}

function badgeOf(sync: Sync, loading: boolean): Badge {
  if (sync.committing) return COMMITTING;
  if (sync.commitError) return FAILED;
  if (sync.unsynced) return unsyncedBadge(sync);
  return SETTLED[settledKey(sync, loading)];
}

/**
 * A floating button at the top right of every page saying whether the photo data pull request has
 * changes ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json don't have yet, opening a panel to commit
 * them. Nothing shows until GitHub is set up.
 */
export function SyncStatus() {
  const settings = useQuery(settingsQuery);
  return githubIsSetUp(settings.data) ? <SyncStatusButton /> : null;
}

function SyncStatusButton() {
  const combined = useCombinedData();
  const sync = useCombinedSync();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Not the whole corner: the floating actions next to the button have their own panels.
  useDismiss(open, [button, panel], () => setOpen(false));
  const badge = badgeOf(sync, combined.isPending);

  return (
    <div className="fixed top-3 right-4 z-40 flex max-w-[calc(100vw-4rem)] flex-col items-end gap-2">
      {/* On a phone the floating actions wrap onto a second row. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "bg-background/95 focus-visible:ring-ring flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-md backdrop-blur outline-none focus-visible:ring-2 [&_svg]:size-4",
            badge.className,
          )}
        >
          <UploadProgressBadge />
          {badge.icon}
          {badge.label}
        </button>
        <FloatingActionsSlot />
      </div>
      {open && <SyncPanel ref={panel} sync={sync} onNavigate={() => setOpen(false)} />}
    </div>
  );
}

/** What's in flight and whether it's synced, with Commit. */
function SyncPanel({
  ref,
  sync,
  onNavigate,
}: {
  ref: React.Ref<HTMLDivElement>;
  sync: Sync;
  onNavigate: () => void;
}) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Photo data sync"
      className="bg-popover text-popover-foreground flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border p-4 text-sm shadow-lg"
    >
      <UploadQueueSection onNavigate={onNavigate} />
      <PullRequestLine sync={sync} />
      <NextUntitledPhoto onNavigate={onNavigate} />
      <ImageCounts images={sync.images} />
      <OpenBatchLine sync={sync} />
      <CommitResult sync={sync} />
      <InFlightBackupSection />
      <div className="flex items-center gap-3">
        <Link
          to="/in-flight"
          onClick={onNavigate}
          className="text-muted-foreground mr-auto underline underline-offset-4"
        >
          Photos in Flight
        </Link>
        <DiscardButton localEdits={sync.localEdits} savedFiles={sync.savedFiles} />
        {canCommit(sync) && <CommitButton variant={sync.unsynced ? "default" : "outline"} />}
      </div>
    </div>
  );
}

function PullRequestLine({ sync }: { sync: Sync }) {
  const pr = sync.pullRequest;
  if (!pr) {
    return (
      <p className={MUTED}>
        No open batch (“Add photo data” pull request). Commit opens one with the changes waiting for
        it.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2">
      <GitPullRequestIcon className="size-4 shrink-0" aria-hidden />
      <a href={pr.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        #{pr.number} {pr.title}
      </a>
    </p>
  );
}

/** Whether there's anything to commit: a pull request, or changes that would open one. */
function canCommit(sync: Sync): boolean {
  return Boolean(sync.pullRequest) || sync.unsynced;
}

/** When everything is committed but the batch is still open, says it's waiting on a merge. */
function OpenBatchLine({ sync }: { sync: Sync }) {
  if (sync.unsynced || sync.committing || !sync.pullRequest) return null;
  return (
    <p className="text-sky-700 dark:text-sky-400">
      Synced. The batch stays open until #{sync.pullRequest.number} is merged.
    </p>
  );
}

/** How many images were added, modified and deleted since the last commit. */
function ImageCounts({ images }: { images: Sync["images"] }) {
  const rows: [number, string][] = [
    [images.added, "Added"],
    [images.modified, "Modified"],
    [images.deleted, "Deleted"],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {rows.map(([count, label]) => (
        <p key={label} className="bg-muted/50 flex flex-col rounded-md py-2">
          <span className={cn("text-2xl font-semibold tabular-nums", count === 0 && MUTED)}>
            {count}
          </span>
          <span className={MUTED}>{label}</span>
        </p>
      ))}
    </div>
  );
}

/** What the last commit did, or why it failed. */
function CommitResult({ sync }: { sync: Sync }) {
  if (sync.commitError) return <CommitError error={sync.commitError} />;
  if (!sync.lastCommit || sync.committing) return null;
  return (
    <>
      <LastCommit commit={sync.lastCommit} />
      <SkippedEdits />
    </>
  );
}

function LastCommit({ commit }: { commit: CombinedCommit }) {
  if (!commit.changed) return <p className={MUTED}>Nothing to commit.</p>;
  return (
    <a href={commit.commitUrl} target="_blank" rel="noreferrer" className={cn(MUTED, "underline")}>
      View last commit
    </a>
  );
}
