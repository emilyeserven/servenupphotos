import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import {
  type InFlightAllPhotos,
  type InFlightFile,
  type InFlightResponse,
  photosInFlightQuery,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/in-flight")({
  component: InFlightPage,
});

function InFlightPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      title="Photos in Flight"
      description="Photo data saved to the open “Add photo data” pull request, not merged yet."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <InFlightCard />
          ) : (
            <Card>
              <CardContent>
                <p className="text-muted-foreground">
                  Not set up: add the GitHub repository and token in{" "}
                  <Link to="/settings" className="text-foreground underline underline-offset-4">
                    Settings
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )
        }
      </QueryResult>
    </Page>
  );
}

function InFlightCard() {
  const inFlight = useQuery(photosInFlightQuery);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pull request</CardTitle>
          <CardDescription>
            {inFlight.data
              ? `${inFlight.data.repo}, JSON in ${inFlight.data.folder}`
              : "Looking in the repository from Settings."}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={inFlight.isFetching}
              onClick={() => void inFlight.refetch()}
            >
              {inFlight.isFetching && <Spinner />}
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <QueryResult query={inFlight} pendingLabel="Reading the pull request from GitHub…">
            {(data) => <PullRequestSummary data={data} />}
          </QueryResult>
        </CardContent>
      </Card>

      {inFlight.data?.files.map((file) => (
        <FileSection key={file.path} file={file} />
      ))}
    </>
  );
}

function FileSection({ file }: { file: InFlightFile }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
        <a
          href={file.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          {file.path.split("/").pop()}
        </a>
        <span className="text-muted-foreground font-normal">{file.status}</span>
        {file.inAllPhotos === null ? null : <AllPhotosMark inAllPhotos={file.inAllPhotos} />}
      </h2>
      {file.error ? (
        <p className="text-destructive text-sm">{file.error}</p>
      ) : (
        <JsonCodeBlock value={file.data} title={file.path} />
      )}
    </section>
  );
}

const ALL_PHOTOS_MARKS = {
  in: {
    Icon: CheckIcon,
    label: "In ALLPHOTOS.json",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  out: {
    Icon: CircleDashedIcon,
    label: "Not in ALLPHOTOS.json",
    className: "text-muted-foreground",
  },
};

/** A check mark when the file's data is an entry of ALLPHOTOS.json. */
function AllPhotosMark({ inAllPhotos }: { inAllPhotos: boolean }) {
  const { Icon, label, className } = ALL_PHOTOS_MARKS[inAllPhotos ? "in" : "out"];
  return (
    <span className={cn("flex items-center gap-1 self-center text-xs font-normal", className)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

function allPhotosSummary(all: InFlightAllPhotos, files: InFlightFile[]): string {
  if (!all.found) return "Not on the branch yet. CI adds it after the next push.";
  if (all.error) return all.error;
  const matched = files.filter((file) => file.inAllPhotos).length;
  return `Lists ${all.count}; ${matched} of ${files.length} photo files match`;
}

function PullRequestSummary({ data }: { data: InFlightResponse }) {
  if (!data.pullRequest) {
    return (
      <p className="text-muted-foreground">
        No open pull request titled “Add photo data”. Saving a photo from{" "}
        <Link to="/exif" className="text-foreground underline underline-offset-4">
          EXIF
        </Link>{" "}
        opens one.
      </p>
    );
  }
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
      <dt className="text-muted-foreground">ALLPHOTOS.json</dt>
      <dd>{allPhotosSummary(data.allPhotos, data.files)}</dd>
    </dl>
  );
}
