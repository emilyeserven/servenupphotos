import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CheckIcon,
  CircleDashedIcon,
  CircleMinusIcon,
  ImageOffIcon,
  PanelRightCloseIcon,
  PencilIcon,
  PanelRightOpenIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  type BaseFile,
  type CombinedFile,
  type InFlightFile,
  type InFlightGroups,
  type InFlightImages,
  type InFlightResponse,
  type CombinedStatus,
  type RemoveResult,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { squareThumbnailUrl, thumbnailPreviewUrl } from "@/api/versions";
import { CommitError } from "@/components/commit-error";
import { JsonCodeBlock } from "@/components/json-code-block";
import { JsonDiffBlock } from "@/components/json-diff-block";
import {
  AllPhotosRebuild,
  CommitButton,
  useAllPhotosRebuild,
} from "@/components/all-photos-rebuild";
import { ImageLightbox } from "@/components/image-lightbox";
import { FileChecks, fileName } from "@/components/in-flight-checks";
import { FileLink, FileStatus, NoPullRequest } from "@/components/in-flight-pending";
import { ReEditMark } from "@/components/re-edit-card";
import { DraftMark } from "@/components/draft-mark";
import { Page } from "@/components/page";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import { RemoveFile, RemovedNotice } from "@/components/remove-in-flight-file";
import { SavedDrafts } from "@/components/saved-drafts";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
import { MoveToUndecided, UndecidedQueue } from "@/components/undecided-photos";
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
import { useInFlight } from "@/hooks/use-in-flight";
import { type PhotoFilters, parseFilters } from "@/lib/photo-filters";
import { undecidedPaths } from "@/lib/undecided";
import { savedTitle, untitledFirst } from "@/lib/untitled-photos";
import { cn } from "@/lib/utils";
import { useCombinedDataStore, useCombinedSync } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";

interface InFlightSearch extends PhotoFilters {
  /** Shows ALLPHOTOS.json in a panel beside the photo files. */
  allPhotos?: true;
}

export const Route = createFileRoute("/in-flight")({
  component: InFlightPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): InFlightSearch => ({
    ...(search.allPhotos === true ? { allPhotos: true } : {}),
    ...parseFilters(search),
  }),
});

function InFlightPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
      title="Photos in Flight"
      description="Photo, album, tag, place, localization, metadata group, camera override and custom lens data waiting for Commit, or in the open “Add photo data” pull request and not merged yet."
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
  const inFlight = useInFlight();
  const refreshCombined = useCombinedDataStore((s) => s.refresh);
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
  };
  const shown = withoutRemoved(inFlight.data, removedPaths);
  const baseBranch = baseBranchOf(shown);
  const showAllPhotos = Route.useSearch({ select: (search) => search.allPhotos === true });

  const files = (
    <div className="flex min-w-0 flex-col gap-6">
      <PullRequestCard
        inFlight={inFlight}
        shown={shown}
        showAllPhotos={showAllPhotos}
        onRefresh={() => {
          // The lists' read asks GitHub again, so the files read after it see a merge too.
          void refreshCombined().then(() => inFlight.refetch());
        }}
      />
      <RemovalNotice
        removed={removed}
        rebuild={rebuild.status}
        onDismiss={() => setRemoved(null)}
      />
      <PhotoFiles
        shown={shown}
        rebuilding={rebuild.rebuilding}
        baseBranch={baseBranch}
        onRemoved={onRemoved}
      />
      {shown &&
        GROUPS.map(([key, title]) => (
          <GroupFiles
            key={key}
            title={title}
            groups={shown[key]}
            rebuilding={rebuild.rebuilding}
            baseBranch={baseBranch}
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

/**
 * The photo files that pass the filters, with the ones without a title first so they're easy to
 * find and name, after the Undecided queue, which takes the photos set aside out of the list. With
 * no photos in flight, the drafts already on the base branch instead.
 */
function PhotoFiles({
  shown,
  ...props
}: {
  shown?: InFlightResponse;
  rebuilding: boolean;
  baseBranch?: string;
  onRemoved: (result: RemoveResult) => void;
}) {
  const edits = useLocalEditsStore((s) => s.edits);
  const { filters, filter } = usePhotoFilters();
  if (!shown) return null;
  if (shown.files.length === 0) return <SavedDrafts />;
  const files = filter(shown.files);
  const undecided = undecidedPaths(files, edits);
  return (
    <>
      <PhotoFilterBar filters={filters} shown={files.length} total={shown.files.length} />
      <UndecidedQueue
        files={files.filter((file) => undecided.has(file.path))}
        images={shown.images}
      />
      {untitledFirst(files.filter((file) => !undecided.has(file.path))).map((file) => (
        <FileSection key={file.path} file={file} images={shown.images} {...props} />
      ))}
    </>
  );
}

/** What the last removal did, then whether ALLPHOTOS.json is synced with it. */
function RemovalNotice({
  removed,
  rebuild,
  onDismiss,
}: {
  removed: RemoveResult | null;
  rebuild: UseQueryResult<CombinedStatus>;
  onDismiss: () => void;
}) {
  if (!removed) return null;
  return (
    <RemovedNotice result={removed} onDismiss={onDismiss}>
      <AllPhotosRebuild status={rebuild} />
    </RemovedNotice>
  );
}

/** The branch the pull request merges into, when there is one. */
function baseBranchOf(data: InFlightResponse | undefined): string | undefined {
  return data?.pullRequest?.baseBranch;
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
function allPhotosProblem(all: CombinedFile): string | undefined {
  if (!all.found) return "Not on the branch yet. Commit adds it.";
  if (all.error) return all.error;
  return all.data ? undefined : "Couldn't read the file.";
}

function AllPhotosFile({ all }: { all: CombinedFile }) {
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
function AllPhotosHeading({ all }: { all?: CombinedFile }) {
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
  baseBranch,
  onRemoved,
}: {
  file: InFlightFile;
  images: InFlightImages;
  /** Whether ALLPHOTOS.json is being committed, so a missing entry may be on its way. */
  rebuilding: boolean;
  /** The branch the pull request merges into, which changed files are compared against. */
  baseBranch?: string;
  onRemoved: (result: RemoveResult) => void;
}) {
  return (
    <section className="@container flex flex-col gap-2">
      <h2 className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
        <PhotoTitle file={file} />
        <FileLink fileUrl={file.fileUrl} name={fileName(file.path)} />
        <FileStatus status={file.status} pending={file.pending} />
        <DraftMark data={file.status === "removed" ? undefined : file.data}>
          <AllPhotosMark inAllPhotos={file.inAllPhotos} rebuilding={rebuilding} />
        </DraftMark>
        <ReEditMark data={file.status === "removed" ? undefined : file.data} />
        <MoveToUndecided file={file} />
        <RemoveFile file={file} images={images} onRemoved={onRemoved} />
      </h2>
      <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PhotoImages file={file} images={images} />
        <FileJson file={file} baseBranch={baseBranch} />
      </div>
    </section>
  );
}

/**
 * A file's JSON from the pull request, with what it changes against the base branch when the pull
 * request changes it rather than adds it, or why it couldn't be read.
 */
function FileJson({
  file,
  baseBranch = "the base branch",
}: {
  file: BaseFile & { path: string; data?: unknown; error?: string };
  baseBranch?: string;
}) {
  if (file.error) return <p className="text-destructive text-sm">{file.error}</p>;
  if (file.base !== undefined) {
    return (
      <JsonDiffBlock value={file.data} base={file.base} title={file.path} baseBranch={baseBranch} />
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {file.baseError && (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t compare it with {baseBranch}: {file.baseError}
        </p>
      )}
      <JsonCodeBlock value={file.data} title={file.path} />
    </div>
  );
}

/** The photo's image from R2, with its Square Thumbnail under it when it has an image. */
function PhotoImages({ file, images }: { file: InFlightFile; images: InFlightImages }) {
  const url = images.byPath[file.path]?.url;
  const square = squareUrl(file, url);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PhotoImage name={photoName(file)} url={url} checked={images.checked} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        {square && (
          <SquareThumbnailImage
            key={square}
            name={photoName(file)}
            url={square}
            previewUrl={squarePreviewUrl(file, url)}
          />
        )}
        {canEdit(file, url) && <EditLink path={file.path} />}
      </div>
    </div>
  );
}

/** What to call the photo: its title, or else its original file name. */
function photoName(file: InFlightFile): string {
  return savedTitle(file) ?? file.photoName;
}

/** The photo's title, ahead of its JSON file's name, when it has one. */
function PhotoTitle({ file }: { file: InFlightFile }) {
  const title = savedTitle(file);
  return title ? <span className="text-base">{title}</span> : null;
}

/** Whether the file's photo can be opened on the Photo page: its JSON was read and its image is in R2. */
function canEdit(file: InFlightFile, imageUrl?: string): boolean {
  return Boolean(imageUrl) && !file.error && file.status !== "removed";
}

/** Opens the photo on the Photo page, to change its Square Thumbnail crop. */
function EditLink({ path }: { path: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/exif" search={{ edit: path }}>
        <PencilIcon />
        Edit
      </Link>
    </Button>
  );
}

/**
 * The Square Thumbnail URL saved in the photo's JSON, or else the one next to its image in R2, or
 * undefined when it has neither.
 */
function squareUrl(file: InFlightFile, imageUrl?: string): string | undefined {
  return savedSquareUrl(file.data) ?? (imageUrl && squareThumbnailUrl(imageUrl));
}

/** The Thumbnail Preview URL saved in the photo's JSON, or else the one next to its image in R2. */
function squarePreviewUrl(file: InFlightFile, imageUrl?: string): string | undefined {
  return (
    savedImageUrl(file.data, "thumbnailpreview") ?? (imageUrl && thumbnailPreviewUrl(imageUrl))
  );
}

function savedSquareUrl(data: unknown): string | undefined {
  return savedImageUrl(data, "thumbnail");
}

function savedImageUrl(data: unknown, name: string): string | undefined {
  const saved = (data as { images?: Record<string, unknown> } | undefined)?.images?.[name];
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
    label: (file: string) => `In ${file}`,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  // Not in it until it's committed.
  out: {
    Icon: CircleDashedIcon,
    label: (file: string) => `Not synced to ${file} yet`,
    className: "text-amber-700 dark:text-amber-400",
  },
  // Not in it yet, but it's being committed.
  pending: {
    Icon: CircleDashedIcon,
    label: (file: string) => `Not synced to ${file} yet`,
    className: "text-muted-foreground [&>svg]:animate-spin",
  },
};

function allPhotosMarkKey(inAllPhotos: boolean, rebuilding: boolean) {
  if (inAllPhotos) return "in";
  return rebuilding ? "pending" : "out";
}

/**
 * A check mark when the file's data is an entry of `allFile` (ALLPHOTOS.json unless named), or a
 * dashed circle marking it not synced when it isn't, spinning while it's committed. Nothing when either file couldn't be
 * read.
 */
function AllPhotosMark({
  inAllPhotos,
  rebuilding,
  allFile = "ALLPHOTOS.json",
}: {
  inAllPhotos: boolean | null;
  rebuilding: boolean;
  allFile?: string;
}) {
  if (inAllPhotos === null) return null;
  const { Icon, label, className } = ALL_PHOTOS_MARKS[allPhotosMarkKey(inAllPhotos, rebuilding)];
  return (
    <span className={cn("flex items-center gap-1 text-xs font-normal", className)}>
      <Icon className="size-4" aria-hidden />
      {label(allFile)}
    </span>
  );
}

type GroupKey = "albums" | "tags" | "places" | "localizations" | "metainfo" | "cameras" | "lenses";

/** The kinds of data files listed after the photos, in order, with their headings. */
const GROUPS: [GroupKey, string][] = [
  ["albums", "Albums"],
  ["tags", "Tags"],
  ["places", "Places"],
  ["localizations", "Localizations"],
  ["metainfo", "Metadata groups"],
  ["cameras", "Camera overrides"],
  ["lenses", "Custom lenses"],
];

/** The album, tag, place or localization files in the pull request, each with its JSON; nothing when there are none. */
function GroupFiles({
  title,
  groups,
  rebuilding,
  baseBranch,
}: {
  title: string;
  groups: InFlightGroups;
  /** Whether the combined files are being committed, so a missing entry may be on its way. */
  rebuilding: boolean;
  /** The branch the pull request merges into, which changed files are compared against. */
  baseBranch?: string;
}) {
  if (groups.files.length === 0) return null;
  const allFile = fileName(groups.all.path);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {groups.files.map((file) => (
        <div key={file.path} className="flex flex-col gap-2">
          <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
            <FileLink fileUrl={file.fileUrl} name={fileName(file.path)} />
            <FileStatus status={file.status} pending={file.pending} />
            <AllPhotosMark inAllPhotos={file.inAll} rebuilding={rebuilding} allFile={allFile} />
          </h3>
          <FileJson file={file} baseBranch={baseBranch} />
        </div>
      ))}
    </section>
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
      <dd>
        <SyncSummary />
      </dd>
      <dt className="text-muted-foreground">File checks</dt>
      <dd>
        <FileChecks data={data} />
      </dd>
    </dl>
  );
}
