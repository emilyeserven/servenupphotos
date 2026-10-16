import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CheckIcon,
  CircleDashedIcon,
  CircleMinusIcon,
  ImageOffIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  type InFlightAllPhotos,
  type InFlightFile,
  type InFlightImages,
  type InFlightResponse,
  type RemoveResult,
  photosInFlightQuery,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Page } from "@/components/page";
import { RemoveFile, RemovedNotice } from "@/components/remove-in-flight-file";
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

interface InFlightSearch {
  /** Shows ALLPHOTOS.json in a panel beside the photo files. */
  allPhotos?: true;
}

export const Route = createFileRoute("/in-flight")({
  component: InFlightPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): InFlightSearch =>
    search.allPhotos === true ? { allPhotos: true } : {},
});

function InFlightPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
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
  const [removed, setRemoved] = useState<RemoveResult | null>(null);
  // Paths removed on this visit, hidden at once: GitHub can list a deleted file for a while.
  const [removedPaths, setRemovedPaths] = useState<ReadonlySet<string>>(new Set());
  const onRemoved = (result: RemoveResult) => {
    setRemoved(result);
    setRemovedPaths((paths) => new Set(paths).add(result.path));
    void inFlight.refetch();
  };
  useRefetchAfterCi(removed, inFlight.refetch);
  const shown = inFlight.data && withoutRemoved(inFlight.data, removedPaths);
  const showAllPhotos = Route.useSearch({ select: (search) => search.allPhotos === true });

  const files = (
    <div className="flex min-w-0 flex-col gap-6">
      <PullRequestCard inFlight={inFlight} shown={shown} showAllPhotos={showAllPhotos} />
      {removed && <RemovedNotice result={removed} onDismiss={() => setRemoved(null)} />}
      {shown?.files.map((file) => (
        <FileSection key={file.path} file={file} images={shown.images} onRemoved={onRemoved} />
      ))}
    </div>
  );

  if (!showAllPhotos) return files;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      {files}
      <aside className="flex flex-col gap-2 lg:sticky lg:top-6">
        <AllPhotosPanel data={inFlight.data} />
      </aside>
    </div>
  );
}

/** How long CI takes to rebuild ALLPHOTOS.json after a push, give or take. */
const CI_REBUILD_MS = 30_000;

/**
 * Refetches once more after a removal, when CI has likely rebuilt ALLPHOTOS.json and GitHub has
 * caught up with the deletion.
 */
function useRefetchAfterCi(removed: RemoveResult | null, refetch: () => unknown) {
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => void refetch(), CI_REBUILD_MS);
    return () => clearTimeout(timer);
  }, [removed, refetch]);
}

/** data without the files removed on this visit, which GitHub may still list for a while. */
function withoutRemoved(data: InFlightResponse, removed: ReadonlySet<string>): InFlightResponse {
  if (removed.size === 0) return data;
  const byPath = Object.fromEntries(
    Object.entries(data.images.byPath).filter(([path]) => !removed.has(path)),
  );
  return {
    ...data,
    files: data.files.filter((file) => !removed.has(file.path)),
    images: { ...data.images, byPath },
  };
}

function PullRequestCard({
  inFlight,
  shown,
  showAllPhotos,
}: {
  inFlight: UseQueryResult<InFlightResponse>;
  /** inFlight's data without the files just removed. */
  shown?: InFlightResponse;
  showAllPhotos: boolean;
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
          {(data) => <PullRequestSummary data={shown ?? data} />}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

/** Shows or hides the ALLPHOTOS.json panel, kept in the URL so a reload keeps it. */
function AllPhotosToggle({ shown }: { shown: boolean }) {
  const navigate = Route.useNavigate();
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

/** ALLPHOTOS.json from the pull request's branch, or why it can't be shown. */
function AllPhotosPanel({ data }: { data?: InFlightResponse }) {
  if (!data?.pullRequest) {
    return (
      <>
        <AllPhotosHeading />
        <PanelNote>
          {data ? "No pull request to read it from." : "Waiting for the pull request."}
        </PanelNote>
      </>
    );
  }
  return <AllPhotosFile all={data.allPhotos} />;
}

/** Why ALLPHOTOS.json can't be shown, or undefined when it can. */
function allPhotosProblem(all: InFlightAllPhotos): string | undefined {
  if (!all.found) return "Not on the branch yet. CI adds it after the next push.";
  if (all.error) return all.error;
  return all.data ? undefined : "Couldn't read the file.";
}

function AllPhotosFile({ all }: { all: InFlightAllPhotos }) {
  const problem = allPhotosProblem(all);
  return (
    <>
      <AllPhotosHeading all={problem ? undefined : all} />
      {problem || !all.data ? (
        <PanelNote>{problem}</PanelNote>
      ) : (
        <JsonCodeBlock
          value={all.data}
          title={all.path}
          contentClassName="max-h-[calc(100svh-8rem)]"
        />
      )}
    </>
  );
}

/** The panel's title, linked to the file on GitHub and with its count once it's read. */
function AllPhotosHeading({ all }: { all?: InFlightAllPhotos }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
      <a
        href={all?.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-4 [&[href]]:hover:underline"
      >
        ALLPHOTOS.json
      </a>
      {all && <span className="text-muted-foreground font-normal">{all.count} listed</span>}
    </h2>
  );
}

function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">{children}</p>
  );
}

function FileSection({
  file,
  images,
  onRemoved,
}: {
  file: InFlightFile;
  images: InFlightImages;
  onRemoved: (result: RemoveResult) => void;
}) {
  return (
    <section className="@container flex flex-col gap-2">
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
        <RemoveFile file={file} images={images} onRemoved={onRemoved} />
      </h2>
      <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PhotoImage
          name={file.photoName}
          url={images.byPath[file.path]?.url}
          checked={images.checked}
        />
        {file.error ? (
          <p className="text-destructive text-sm">{file.error}</p>
        ) : (
          <JsonCodeBlock value={file.data} title={file.path} />
        )}
      </div>
    </section>
  );
}

const MISSING_IMAGE = {
  missing: { Icon: CircleMinusIcon, label: "No image in R2", className: "text-destructive" },
  unchecked: { Icon: ImageOffIcon, label: "Couldn't check R2", className: "text-muted-foreground" },
};

/** The photo's image from R2, or a "do not enter" sign when it has none. */
function PhotoImage({ name, url, checked }: { name: string; url?: string; checked: boolean }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="bg-muted max-h-[32rem] w-full rounded-xl border object-contain"
        />
      </a>
    );
  }
  const { Icon, label, className } = MISSING_IMAGE[checked ? "missing" : "unchecked"];
  return (
    <div className="bg-muted/40 flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm">
      <Icon className={cn("size-10", className)} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground font-mono text-xs">{name}</span>
    </div>
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

function imagesSummary(images: InFlightImages, files: number): string {
  if (!images.checked) return images.message ?? "Couldn't check R2.";
  return `${Object.keys(images.byPath).length} of ${files} found in R2`;
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
      <dt className="text-muted-foreground">Images</dt>
      <dd>{imagesSummary(data.images, count)}</dd>
    </dl>
  );
}
