import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { GitPullRequestIcon, ImageOffIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type BucketImage,
  type InFlightResponse,
  bucketImagesQuery,
  photosInFlightQuery,
} from "@/api/photos";
import { type SettingsResponse, settingsQuery } from "@/api/settings";
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

export const Route = createFileRoute("/bucket")({
  component: BucketPage,
  staticData: { wide: true },
});

function BucketPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page wide title="Explore Bucket" description="Every image in the R2 bucket, newest first.">
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

/** Whether Settings has everything needed to list the bucket and show its images. */
function r2IsSetUp(r2: SettingsResponse["r2"]): boolean {
  return [r2.accountId, r2.accessKeyId, r2.secretAccessKey.set, r2.bucket, r2.publicUrl].every(
    Boolean,
  );
}

function BucketCard({ githubIsSetUp }: { githubIsSetUp: boolean }) {
  const bucket = useQuery(bucketImagesQuery);
  const inFlight = useInFlightImages(githubIsSetUp);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bucket</CardTitle>
          <CardDescription>
            {bucket.data
              ? `${bucket.data.bucket}: ${imageCount(bucket.data.images.length)}`
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
      </Card>

      {bucket.data ? <BucketGrid images={bucket.data.images} inFlight={inFlight} /> : null}
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

/** The images whose photo data is in the open pull request, and that pull request's number. */
interface InFlightImages {
  keys: Set<string>;
  pullRequestNumber?: number;
}

/** In-flight images from Photos in Flight's data; none when GitHub isn't set up or it fails. */
function useInFlightImages(githubIsSetUp: boolean): InFlightImages {
  const inFlight = useQuery({ ...photosInFlightQuery, enabled: githubIsSetUp });
  return useMemo(() => inFlightImages(inFlight.data), [inFlight.data]);
}

/** R2 keys from the images matched in R2 and the keys saved with the photo data. */
function inFlightImages(data?: InFlightResponse): InFlightImages {
  if (!data?.pullRequest) return { keys: new Set() };
  const matched = Object.values(data.images.byPath).map((image) => image.key);
  const saved = data.files.flatMap((file) => (file.imageKey ? [file.imageKey] : []));
  return { keys: new Set([...matched, ...saved]), pullRequestNumber: data.pullRequest.number };
}

function BucketGrid({ images, inFlight }: { images: BucketImage[]; inFlight: InFlightImages }) {
  if (images.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <li key={image.key}>
          <BucketTile
            image={image}
            inFlightPullRequest={
              inFlight.keys.has(image.key) ? inFlight.pullRequestNumber : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
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

/**
 * One image from the bucket, linking to its public URL, with its key, size and upload time.
 * An image whose photo data is still in the open pull request is faded with a PR badge.
 */
function BucketTile({
  image,
  inFlightPullRequest,
}: {
  image: BucketImage;
  /** The open pull request holding this image's photo data, when there is one. */
  inFlightPullRequest?: number;
}) {
  const [failed, setFailed] = useState(false);
  const inFlight = inFlightPullRequest !== undefined;
  return (
    <figure className="flex flex-col gap-1.5">
      <a href={image.url} target="_blank" rel="noreferrer" className="relative block">
        {failed ? (
          <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm">
            <ImageOffIcon className="size-8" aria-hidden />
            Couldn't load
          </div>
        ) : (
          <img
            src={image.url}
            alt={image.key}
            loading="lazy"
            onError={() => setFailed(true)}
            className={cn(
              "bg-muted aspect-square w-full rounded-xl border object-cover",
              inFlight && "opacity-80",
            )}
          />
        )}
        {inFlight && <InFlightBadge pullRequest={inFlightPullRequest} />}
      </a>
      <figcaption className="flex flex-col text-xs">
        <span className="truncate font-mono" title={image.key}>
          {image.key}
        </span>
        <span className="text-muted-foreground">
          {formatSize(image.size)} · {dateFormat.format(new Date(image.modified))}
        </span>
      </figcaption>
    </figure>
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
