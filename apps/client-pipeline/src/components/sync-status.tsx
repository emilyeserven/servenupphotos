import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleDotIcon, GitPullRequestIcon, TriangleAlertIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { CombinedCommit } from "@/api/photos";
import { githubIsSetUp, settingsQuery } from "@/api/settings";
import { CommitButton } from "@/components/all-photos-rebuild";
import { Spinner } from "@/components/ui/spinner";
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

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

function unsyncedBadge(sync: Sync): Badge {
  const label = sync.pending ? `Not synced · ${sync.pending}` : "Not synced";
  return { icon: <CircleDotIcon />, label, className: AMBER };
}

type Settled = "checking" | "none" | "synced";

const SETTLED: Record<Settled, Badge> = {
  checking: { icon: <Spinner />, label: "Checking…", className: MUTED },
  none: { icon: <CheckIcon />, label: "Nothing in flight", className: MUTED },
  synced: {
    icon: <CheckIcon />,
    label: "Synced",
    className: "text-emerald-700 dark:text-emerald-400",
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

/** Closes the panel on a click outside ref, or Escape. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
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
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  const badge = badgeOf(sync, combined.isPending);

  return (
    <div ref={ref} className="fixed top-3 right-4 z-40 flex flex-col items-end gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "bg-background/95 focus-visible:ring-ring flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-md backdrop-blur outline-none focus-visible:ring-2 [&_svg]:size-4",
          badge.className,
        )}
      >
        {badge.icon}
        {badge.label}
      </button>
      {open && <SyncPanel sync={sync} onNavigate={() => setOpen(false)} />}
    </div>
  );
}

/** What's in flight and whether it's synced, with Commit. */
function SyncPanel({ sync, onNavigate }: { sync: Sync; onNavigate: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Photo data sync"
      className="bg-popover text-popover-foreground flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border p-4 text-sm shadow-lg"
    >
      <PullRequestLine sync={sync} />
      <SyncLine sync={sync} />
      <CommitResult sync={sync} />
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/in-flight"
          onClick={onNavigate}
          className="text-muted-foreground underline underline-offset-4"
        >
          Photos in Flight
        </Link>
        {sync.pullRequest && <CommitButton variant={sync.unsynced ? "default" : "outline"} />}
      </div>
    </div>
  );
}

function PullRequestLine({ sync }: { sync: Sync }) {
  const pr = sync.pullRequest;
  if (!pr) return <p className={MUTED}>No “Add photo data” pull request is open.</p>;
  return (
    <p className="flex items-center gap-2">
      <GitPullRequestIcon className="size-4 shrink-0" aria-hidden />
      <a href={pr.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        #{pr.number} {pr.title}
      </a>
    </p>
  );
}

/** Whether the combined files have the pull request's changes, and what the app shows already. */
function SyncLine({ sync }: { sync: Sync }) {
  if (!sync.pullRequest) return null;
  if (!sync.unsynced) {
    return <p className={MUTED}>ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json are up to date.</p>;
  }
  return (
    <p className={AMBER}>
      {unsyncedWhat(sync)}, not in ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json yet. Commit to
      sync them.
    </p>
  );
}

/** What hasn't been committed yet, as SyncLine says it. */
function unsyncedWhat(sync: Sync): string {
  return sync.pending
    ? `${sync.pending} changed since the last commit`
    : "The pull request changed since the last commit";
}

/** What the last commit did, or why it failed. */
function CommitResult({ sync }: { sync: Sync }) {
  if (sync.commitError) return <p className="text-destructive">{sync.commitError.message}</p>;
  if (!sync.lastCommit || sync.committing) return null;
  return <LastCommit commit={sync.lastCommit} />;
}

function LastCommit({ commit }: { commit: CombinedCommit }) {
  if (!commit.changed) return <p className={MUTED}>The last commit found nothing to change.</p>;
  return (
    <p className={MUTED}>
      Committed {plural(commit.files.length, "file")}.{" "}
      <a href={commit.commitUrl} target="_blank" rel="noreferrer" className="underline">
        View commit
      </a>
    </p>
  );
}
