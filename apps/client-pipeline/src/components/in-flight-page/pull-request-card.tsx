import { type UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import { type InFlightResponse } from "@/api/photos";
import { CommitButton } from "@/components/all-photos-rebuild";
import { CommitError } from "@/components/commit-error";
import { FileChecks } from "@/components/in-flight-checks";
import { PullRequestSummarySkeleton } from "@/components/in-flight-loading";
import { NoPullRequest } from "@/components/in-flight-pending";
import { QueryResult } from "@/components/query-result";
import { SkippedEdits } from "@/components/skipped-edits";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useCombinedSync } from "@/stores/combined-data";

/** The "Add photo data" pull request's card: where it is, its summary, and the ALLPHOTOS.json and Refresh buttons. */
export function PullRequestCard({
  inFlight,
  shown,
  showAllPhotos,
  onRefresh,
}: {
  inFlight: UseQueryResult<InFlightResponse>;
  /** inFlight's data without the files just removed. */
  shown?: InFlightResponse;
  showAllPhotos: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull request</CardTitle>
        <CardDescription>
          {inFlight.data
            ? `${inFlight.data.repo}, JSON in ${inFlight.data.folder}`
            : "Looking in the repository from Settings."}
        </CardDescription>
        <CardAction className="flex gap-2">
          <AllPhotosToggle shown={showAllPhotos} />
          <Button variant="outline" size="sm" disabled={inFlight.isFetching} onClick={onRefresh}>
            {inFlight.isFetching && <Spinner />}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <QueryResult query={inFlight} pending={<PullRequestSummarySkeleton />}>
          {(data) => <PullRequestSummary data={shown ?? data} />}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

/** Shows or hides the ALLPHOTOS.json panel, kept in the URL so a reload keeps it. */
function AllPhotosToggle({ shown }: { shown: boolean }) {
  const navigate = useNavigate({ from: "/in-flight" });
  const Icon = shown ? PanelRightCloseIcon : PanelRightOpenIcon;
  return (
    <Button
      variant={shown ? "secondary" : "outline"}
      size="sm"
      aria-pressed={shown}
      onClick={() =>
        void navigate({
          search: (prev) => ({ ...prev, allPhotos: shown ? undefined : true }),
          replace: true,
        })
      }
    >
      <Icon />
      ALLPHOTOS.json
    </Button>
  );
}

/**
 * Whether ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json have every change, as checked when the
 * app started and known from the app's saves and commits since, with Commit to sync them.
 */
function SyncSummary() {
  const sync = useCombinedSync();
  if (sync.committing) {
    return (
      <span className="text-muted-foreground flex items-center gap-2">
        <Spinner />
        Committing them…
      </span>
    );
  }
  if (sync.commitError) return <CommitError error={sync.commitError} />;
  if (!sync.unsynced) return <span className="text-muted-foreground">Up to date</span>;
  return (
    <span className="flex flex-col items-start gap-2">
      <span className="text-amber-700 dark:text-amber-400">{unsyncedText(sync.pending)}</span>
      <CommitButton />
    </span>
  );
}

/** Why the combined files aren't synced, and what the pages already show of it. */
function unsyncedText(pending: string): string {
  const since = pending
    ? `${pending} changed since the last commit`
    : "changes are waiting for Commit";
  return `Not synced: ${since}. Commit sends them to GitHub.`;
}

function PullRequestSummary({ data }: { data: InFlightResponse }) {
  if (!data.pullRequest) return <NoPullRequest data={data} />;
  const pr = data.pullRequest;
  const count = data.files.length;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Pull request</dt>
      <dd>
        <a href={pr.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          #{pr.number} {pr.title}
        </a>
      </dd>
      <dt className="text-muted-foreground">Branch</dt>
      <dd className="font-mono">{pr.branch}</dd>
      <dt className="text-muted-foreground">Photo files</dt>
      <dd>{count === 0 ? "None in the data folder" : count}</dd>
      <dt className="text-muted-foreground">Synced</dt>
      <dd className="flex flex-col items-start gap-2">
        <SyncSummary />
        <SkippedEdits />
      </dd>
      <dt className="text-muted-foreground">File checks</dt>
      <dd>
        <FileChecks data={data} />
      </dd>
    </dl>
  );
}
