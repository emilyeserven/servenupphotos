import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BookCheckIcon, GitPullRequestIcon, ImageOffIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { type BucketImage, bucketImagesQuery } from "@/api/photos";
import { r2IsSetUp, settingsQuery } from "@/api/settings";
import { type PUBLISHED, THUMBNAIL, keyStem, parseVersionKey } from "@/api/versions";
import { GenerateJsonButton } from "@/components/generate-json";
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
import { type PhotoMarks, usePhotoMarks } from "@/hooks/use-photo-marks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bucket")({
  component: BucketPage,
  staticData: { wide: true },
});

function BucketPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
      title="Explore Bucket"
      description="Every image in the R2 bucket, newest first. Click a stack to see its resized copies, or generate JSON for a photo that isn't saved yet."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          r2IsSetUp(data.r2) ? (
            <BucketCard githubIsSetUp={Boolean(data.github.repo && data.github.token.set)} />
          ) : (
            <Card>
              <CardContent>
                <p className="text-muted-foreground">
                  Not set up: add the R2 bucket, keys and public URL in{" "}
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

function BucketCard({ githubIsSetUp }: { githubIsSetUp: boolean }) {
  const bucket = useQuery(bucketImagesQuery);
  const marks = usePhotoMarks(githubIsSetUp, bucket.data);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bucket</CardTitle>
          <CardDescription>
            {bucket.data
              ? `${bucket.data.bucket}: ${photoCount(bucket.data.images)}, ${imageCount(bucket.data.images.length)}`
              : "Listing the bucket from Settings."}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={bucket.isFetching}
              onClick={() => void bucket.refetch()}
            >
              {bucket.isFetching && <Spinner />}
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <BucketEmpty />
        <MarksNote githubIsSetUp={githubIsSetUp} problem={marks.problem} />
      </Card>

      {bucket.data ? <BucketGrid images={bucket.data.images} marks={marks} /> : null}
    </>
  );
}

/** The listing's loading, error or empty state; nothing once there are images. */
function BucketEmpty() {
  const bucket = useQuery(bucketImagesQuery);
  if (bucket.isSuccess && bucket.data.images.length > 0) return null;
  return (
    <CardContent>
      <QueryResult query={bucket} pendingLabel="Listing images in R2…">
        {() => <p className="text-muted-foreground">No images in this bucket yet.</p>}
      </QueryResult>
    </CardContent>
  );
}

/** Why photos can't be marked, so no JSON can be generated: GitHub isn't set up or a check failed. */
function MarksNote({ githubIsSetUp, problem }: { githubIsSetUp: boolean; problem?: Error }) {
  if (!githubIsSetUp) return <GitHubNotSetUp />;
  if (!problem) return null;
  return (
    <CardContent>
      <p className="text-muted-foreground text-sm">
        Couldn't check which photos are saved already, so JSON can't be generated: {problem.message}
      </p>
    </CardContent>
  );
}

function GitHubNotSetUp() {
  return (
    <CardContent>
      <p className="text-muted-foreground text-sm">
        Set the GitHub repository and token in{" "}
        <Link to="/settings" className="text-foreground underline underline-offset-4">
          Settings
        </Link>{" "}
        to see which photos are saved and generate JSON for the ones that aren't.
      </p>
    </CardContent>
  );
}

/** What a tile shows about its photo's data: in flight, in ALLPHOTOS.json, or a way to make it. */
interface TileStatus {
  /** The open pull request holding this image's photo data, when there is one. */
  inFlightPullRequest?: number;
  published: boolean;
  /** For an original JPEG whose photo isn't saved anywhere: its resized copies, for the JSON. */
  generate?: BucketImage[];
}

function tileStatus(marks: PhotoMarks, image: BucketImage): TileStatus {
  const inFlight = marks.inFlight.keys.has(image.key);
  return {
    inFlightPullRequest: inFlight ? marks.inFlight.pullRequestNumber : undefined,
    published: marks.published.has(image.key),
  };
}

/** A stack original's status, which can generate JSON when its photo is saved nowhere. */
function originalStatus(marks: PhotoMarks, stack: Stack): TileStatus {
  const status = tileStatus(marks, stack.image);
  if (!isUnsavedOriginal(marks, stack, status)) return status;
  return { ...status, generate: stack.copies.map((copy) => copy.image) };
}

/** Whether the stack's image is an original JPEG whose photo the checks found saved nowhere. */
function isUnsavedOriginal(marks: PhotoMarks, stack: Stack, status: TileStatus): boolean {
  return [
    marks.checked,
    status.inFlightPullRequest === undefined,
    !status.published,
    !stack.label,
    /\.jpe?g$/i.test(stack.image.key),
  ].every(Boolean);
}

/** One image from the bucket, with its size label when it's a resized copy. */
interface Tile {
  image: BucketImage;
  /** What size it is, for a resized copy: "Large · 1800px". */
  label?: string;
}

/** An image and the resized copies uploaded with it, which collapse behind it. */
interface Stack extends Tile {
  copies: Tile[];
}

function sizeLabel(version: (typeof PUBLISHED)[number]): string {
  if (version.name === THUMBNAIL.name)
    return `${version.label} · ${version.maxEdge}×${version.maxEdge}px`;
  return `${version.label} · ${version.maxEdge}px`;
}

/**
 * Groups each original with the resized copies uploaded with it, largest first, keeping the
 * listing's order. A copy whose original isn't in the bucket stands alone, with its size label.
 */
function stackImages(images: BucketImage[]): Stack[] {
  const parsed = images.map((image) => ({ image, version: parseVersionKey(image.key) }));
  const originals = new Set(
    parsed.flatMap(({ image, version }) => (version ? [] : [keyStem(image.key)])),
  );
  const isCopy = (entry: (typeof parsed)[number]) =>
    entry.version !== undefined && originals.has(entry.version.originalStem);
  const copies = parsed
    .filter(isCopy)
    .toSorted((a, b) => (b.version?.version.maxEdge ?? 0) - (a.version?.version.maxEdge ?? 0));
  return parsed
    .filter((entry) => !isCopy(entry))
    .map(({ image, version }) => ({
      image,
      label: version && sizeLabel(version.version),
      copies: copies
        .filter((copy) => copy.version?.originalStem === keyStem(image.key))
        .map((copy) => ({
          image: copy.image,
          label: copy.version && sizeLabel(copy.version.version),
        })),
    }));
}

function BucketGrid({ images, marks }: { images: BucketImage[]; marks: PhotoMarks }) {
  const stacks = useMemo(() => stackImages(images), [images]);
  if (stacks.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 pt-3 pr-3 sm:grid-cols-3 lg:grid-cols-4">
      {stacks.map((stack) => (
        <StackItems key={stack.image.key} stack={stack} marks={marks} />
      ))}
    </ul>
  );
}

/** A stack's original, and its resized copies right after it once it's opened. */
function StackItems({ stack, marks }: { stack: Stack; marks: PhotoMarks }) {
  const [expanded, setExpanded] = useState(false);
  const toggle =
    stack.copies.length > 0
      ? { count: stack.copies.length, expanded, onToggle: () => setExpanded(!expanded) }
      : undefined;
  return (
    <>
      <li>
        <BucketTile tile={stack} stack={toggle} status={originalStatus(marks, stack)} />
      </li>
      {expanded &&
        stack.copies.map((copy) => (
          <li key={copy.image.key}>
            <BucketTile tile={copy} status={tileStatus(marks, copy.image)} />
          </li>
        ))}
    </>
  );
}

/** How many photos the bucket holds, counting each original with its resized copies as one. */
function photoCount(images: BucketImage[]): string {
  const count = images.filter((image) => !parseVersionKey(image.key)).length;
  return count === 1 ? "1 photo" : `${count} photos`;
}

function imageCount(count: number): string {
  return count === 1 ? "1 image" : `${count} images`;
}

const sizeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

/** How a stack's original opens and closes its resized copies. */
interface StackToggle {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

interface BucketTileProps {
  tile: Tile;
  /** For an original with resized copies: clicking it shows or hides them. */
  stack?: StackToggle;
  status: TileStatus;
}

/**
 * One image from the bucket with its key, size and upload time; the key links to its public
 * URL. An image whose photo data is still in the open pull request is faded with a PR badge, one
 * in ALLPHOTOS.json has its own badge, and an original saved in neither can generate its JSON.
 */
function BucketTile({ tile, stack, status }: BucketTileProps) {
  const media = (
    <>
      <TileImage image={tile.image} faded={status.inFlightPullRequest !== undefined} />
      <StatusBadge status={status} />
      <TileLabel text={stack ? stackLabel(stack) : tile.label} />
    </>
  );
  return (
    <figure className="flex flex-col gap-1.5">
      {stack ? (
        <StackMedia stack={stack}>{media}</StackMedia>
      ) : (
        <a href={tile.image.url} target="_blank" rel="noreferrer" className="relative block">
          {media}
        </a>
      )}
      <TileCaption image={tile.image} />
      {status.generate && <GenerateJsonButton original={tile.image} copies={status.generate} />}
    </figure>
  );
}

function stackLabel(stack: StackToggle): string {
  const sizes = stack.count === 1 ? "1 size" : `${stack.count} sizes`;
  return stack.expanded ? `Original · hide ${sizes}` : `Original + ${sizes}`;
}

/** A stack's original: blank squares peek out behind it while its copies are hidden. */
function StackMedia({ stack, children }: { stack: StackToggle; children: ReactNode }) {
  return (
    <div className="relative">
      {!stack.expanded && (
        <>
          <span
            aria-hidden
            className="bg-muted border-foreground/15 absolute inset-0 translate-x-3 -translate-y-3 rounded-xl border"
          />
          <span
            aria-hidden
            className="bg-muted border-foreground/20 absolute inset-0 translate-x-1.5 -translate-y-1.5 rounded-xl border shadow-sm"
          />
        </>
      )}
      <button
        type="button"
        aria-expanded={stack.expanded}
        title={stack.expanded ? "Hide the resized copies" : "Show the resized copies"}
        onClick={stack.onToggle}
        className="focus-visible:ring-ring relative block w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2"
      >
        {children}
      </button>
    </div>
  );
}

function TileImage({ image, faded }: { image: BucketImage; faded: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm">
        <ImageOffIcon className="size-8" aria-hidden />
        Couldn't load
      </div>
    );
  }
  return (
    <img
      src={image.url}
      alt={image.key}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "bg-muted aspect-square w-full rounded-xl border object-cover",
        faded && "opacity-80",
      )}
    />
  );
}

/** A size label in the image's bottom corner. */
function TileLabel({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="bg-background/85 text-foreground absolute bottom-2 left-2 rounded-md border px-1.5 py-0.5 text-xs font-medium shadow-sm">
      {text}
    </span>
  );
}

function TileCaption({ image }: { image: BucketImage }) {
  return (
    <figcaption className="flex flex-col text-xs">
      <a
        href={image.url}
        target="_blank"
        rel="noreferrer"
        className="truncate font-mono hover:underline"
        title={image.key}
      >
        {image.key}
      </a>
      <span className="text-muted-foreground">
        {formatSize(image.size)} · {dateFormat.format(new Date(image.modified))}
      </span>
    </figcaption>
  );
}

/** A pull request icon in the image's corner, for an image that isn't merged yet. */
function InFlightBadge({ pullRequest }: { pullRequest: number }) {
  const label = `In flight: in pull request #${pullRequest}, not merged yet`;
  return (
    <span
      title={label}
      className="bg-background/80 text-foreground absolute top-2 right-2 flex size-7 items-center justify-center rounded-md border shadow-sm"
    >
      <GitPullRequestIcon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The in-flight badge, or the ALLPHOTOS.json one, or nothing for a photo saved nowhere. */
function StatusBadge({ status }: { status: TileStatus }) {
  if (status.inFlightPullRequest !== undefined) {
    return <InFlightBadge pullRequest={status.inFlightPullRequest} />;
  }
  return status.published ? <PublishedBadge /> : null;
}

/** A book icon in the image's corner, for a photo already in ALLPHOTOS.json. */
function PublishedBadge() {
  const label = "Saved: already in ALLPHOTOS.json";
  return (
    <span
      title={label}
      className="bg-background/80 text-foreground absolute top-2 right-2 flex size-7 items-center justify-center rounded-md border shadow-sm"
    >
      <BookCheckIcon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
