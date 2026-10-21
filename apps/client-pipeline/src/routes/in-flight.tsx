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
import { type ReactNode, useState } from "react";
import {
  type InFlightAllPhotos,
  type InFlightFile,
  type InFlightImages,
  type InFlightResponse,
  type CombineStatus,
  type RemoveResult,
  photosInFlightQuery,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { squareThumbnailUrl } from "@/api/versions";
import { JsonCodeBlock } from "@/components/json-code-block";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { ImageLightbox } from "@/components/image-lightbox";
import { Page } from "@/components/page";
import { RemoveFile, RemovedNotice } from "@/components/remove-in-flight-file";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
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
  const rebuild = useAllPhotosRebuild(Boolean(inFlight.data?.pullRequest), () => {
    void inFlight.refetch();
  });
  const onRemoved = (result: RemoveResult) => {
    setRemoved(result);
    setRemovedPaths((paths) => new Set(paths).add(result.path));
    void inFlight.refetch();
    rebuild.afterPush();
  };
  const shown = withoutRemoved(inFlight.data, removedPaths);
  const showAllPhotos = Route.useSearch({ select: (search) => search.allPhotos === true });

  const files = (
    <div className="flex min-w-0 flex-col gap-6">
      <PullRequestCard
        inFlight={inFlight}
        shown={shown}
        rebuilding={rebuild.rebuilding}
        showAllPhotos={showAllPhotos}
        onRefresh={() => {
          void inFlight.refetch();
          void rebuild.status.refetch();
        }}
      />
      <RemovalNotice
        removed={removed}
        rebuild={rebuild.status}
        onDismiss={() => setRemoved(null)}
      />
      {shown?.files.map((file) => (
        <FileSection
          key={file.path}
          file={file}
          images={shown.images}
          rebuilding={rebuild.rebuilding}
          onRemoved={onRemoved}
        />
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

/** What the last removal did, then how the ALLPHOTOS.json rebuild after it is going. */
function RemovalNotice({
  removed,
  rebuild,
  onDismiss,
}: {
  removed: RemoveResult | null;
  rebuild: UseQueryResult<CombineStatus>;
  onDismiss: () => void;
}) {
  if (!removed) return null;
  return (
    <RemovedNotice result={removed} onDismiss={onDismiss}>
      <AllPhotosRebuild status={rebuild} />
    </RemovedNotice>
  );
}

/** data without the files removed on this visit, which GitHub may still list for a while. */
function withoutRemoved(
  data: InFlightResponse | undefined,
  removed: ReadonlySet<string>,
): InFlightResponse | undefined {
  if (!data || removed.size === 0) return data;
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
  rebuilding,
  showAllPhotos,
  onRefresh,
}: {
  inFlight: UseQueryResult<InFlightResponse>;
  /** inFlight's data without the files just removed. */
  shown?: InFlightResponse;
  /** Whether CI is rebuilding ALLPHOTOS.json. */
  rebuilding: boolean;
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
        <QueryResult query={inFlight} pendingLabel="Reading the pull request from GitHub…">
          {(data) => <PullRequestSummary data={shown ?? data} rebuilding={rebuilding} />}
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
  rebuilding,
  onRemoved,
}: {
  file: InFlightFile;
  images: InFlightImages;
  /** Whether CI is rebuilding ALLPHOTOS.json, so a missing entry may be on its way. */
  rebuilding: boolean;
  onRemoved: (result: RemoveResult) => void;
}) {
  return (
    <section className="@container flex flex-col gap-2">
      <h2 className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
        <a
          href={file.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          {file.path.split("/").pop()}
        </a>
        <span className="text-muted-foreground font-normal">{file.status}</span>
        <AllPhotosMark inAllPhotos={file.inAllPhotos} rebuilding={rebuilding} />
        <RemoveFile file={file} images={images} onRemoved={onRemoved} />
      </h2>
      <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PhotoImages file={file} images={images} />
        {file.error ? (
          <p className="text-destructive text-sm">{file.error}</p>
        ) : (
          <JsonCodeBlock value={file.data} title={file.path} />
        )}
      </div>
    </section>
  );
}

/** The photo's image from R2, with its Square Thumbnail under it when it has an image. */
function PhotoImages({ file, images }: { file: InFlightFile; images: InFlightImages }) {
  const url = images.byPath[file.path]?.url;
  const square = squareUrl(file, url);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PhotoImage name={file.photoName} url={url} checked={images.checked} />
      {square && <SquareThumbnailImage key={square} name={file.photoName} url={square} />}
    </div>
  );
}

/**
 * The Square Thumbnail URL saved in the photo's JSON, or else the one next to its image in R2, or
 * undefined when it has neither.
 */
function squareUrl(file: InFlightFile, imageUrl?: string): string | undefined {
  return savedSquareUrl(file.data) ?? (imageUrl && squareThumbnailUrl(imageUrl));
}

function savedSquareUrl(data: unknown): string | undefined {
  const saved = (data as { images?: { thumbnail?: unknown } } | undefined)?.images?.thumbnail;
  return typeof saved === "string" ? saved || undefined : undefined;
}

const MISSING_IMAGE = {
  missing: { Icon: CircleMinusIcon, label: "No image in R2", className: "text-destructive" },
  unchecked: { Icon: ImageOffIcon, label: "Couldn't check R2", className: "text-muted-foreground" },
};

/** The photo's image from R2, opening full size in a lightbox, or a "do not enter" sign when it has none. */
function PhotoImage({ name, url, checked }: { name: string; url?: string; checked: boolean }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  if (url && !failed) {
    return (
      <>
        <button
          type="button"
          title="Show it full size"
          onClick={() => setOpen(true)}
          className="focus-visible:ring-ring cursor-zoom-in rounded-xl outline-none focus-visible:ring-2"
        >
          <img
            src={url}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="bg-muted max-h-[32rem] w-full rounded-xl border object-contain"
          />
        </button>
        <ImageLightbox
          open={open}
          onClose={() => setOpen(false)}
          title={name}
          src={url}
          description={`${name} at full size.`}
        />
      </>
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
  // Not in it yet, but CI is rebuilding it.
  pending: {
    Icon: CircleDashedIcon,
    label: "Not in ALLPHOTOS.json yet",
    className: "text-muted-foreground [&>svg]:animate-spin",
  },
};

function allPhotosMarkKey(inAllPhotos: boolean, rebuilding: boolean) {
  if (inAllPhotos) return "in";
  return rebuilding ? "pending" : "out";
}

/**
 * A check mark when the file's data is an entry of ALLPHOTOS.json, or a dashed circle when it
 * isn't, spinning while CI rebuilds the file. Nothing when either file couldn't be read.
 */
function AllPhotosMark({
  inAllPhotos,
  rebuilding,
}: {
  inAllPhotos: boolean | null;
  rebuilding: boolean;
}) {
  if (inAllPhotos === null) return null;
  const { Icon, label, className } = ALL_PHOTOS_MARKS[allPhotosMarkKey(inAllPhotos, rebuilding)];
  return (
    <span className={cn("flex items-center gap-1 text-xs font-normal", className)}>
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

/** A spinner and note beside ALLPHOTOS.json while CI rebuilds it. */
function RebuildingNote({ rebuilding }: { rebuilding: boolean }) {
  if (!rebuilding) return null;
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      <Spinner />
      CI is rebuilding it
    </span>
  );
}

function imagesSummary(images: InFlightImages, files: number): string {
  if (!images.checked) return images.message ?? "Couldn't check R2.";
  return `${Object.keys(images.byPath).length} of ${files} found in R2`;
}

function PullRequestSummary({ data, rebuilding }: { data: InFlightResponse; rebuilding: boolean }) {
  if (!data.pullRequest) {
    return (
      <p className="text-muted-foreground">
        No open pull request titled “Add photo data”. Saving a photo from{" "}
        <Link to="/exif" className="text-foreground underline underline-offset-4">
          Photo
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
      <dd className="flex items-center gap-2">
        {allPhotosSummary(data.allPhotos, data.files)}
        <RebuildingNote rebuilding={rebuilding} />
      </dd>
      <dt className="text-muted-foreground">Images</dt>
      <dd>{imagesSummary(data.images, count)}</dd>
    </dl>
  );
}
