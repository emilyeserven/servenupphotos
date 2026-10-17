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
  const inFlight = useQuery({ ...photosInFlightQuery, enabled: githubIsSetUp });
  const inFlightKeys = useMemo(() => inFlightImageKeys(inFlight.data), [inFlight.data]);

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

      {bucket.data ? (
        <BucketGrid
          images={bucket.data.images}
          inFlightKeys={inFlightKeys}
          pullRequestNumber={inFlight.data?.pullRequest?.number}
        />
      ) : null}
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

/**
 * R2 keys of the images whose photo data is in the open pull request, from the
 * images matched in R2 and the keys saved with the data.
 */
function inFlightImageKeys(data?: InFlightResponse): Set<string> {
  const keys = new Set<string>();
  if (!data?.pullRequest) return keys;
  for (const image of Object.values(data.images.byPath)) keys.add(image.key);
  for (const file of data.files) if (file.imageKey) keys.add(file.imageKey);
  return keys;
}

function BucketGrid({
  images,
  inFlightKeys,
  pullRequestNumber,
}: {
  images: BucketImage[];
  inFlightKeys: Set<string>;
  pullRequestNumber?: number;
}) {
  if (images.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <li key={image.key}>
          <BucketTile
            image={image}
            inFlight={inFlightKeys.has(image.key)}
            pullRequestNumber={pullRequestNumber}
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
  inFlight,
  pullRequestNumber,
}: {
  image: BucketImage;
  inFlight: boolean;
  pullRequestNumber?: number;
}) {
  const [failed, setFailed] = useState(false);
  const inFlightLabel = pullRequestNumber
    ? `In flight: in pull request #${pullRequestNumber}, not merged yet`
    : "In flight: in the open pull request, not merged yet";
  return (
    <figure className="flex flex-col gap-1.5">
      <a
        href={image.url}
        target="_blank"
        rel="noreferrer"
        className="relative block"
        title={inFlight ? inFlightLabel : undefined}
      >
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
        {inFlight && (
          <span className="bg-background/80 text-foreground absolute top-2 right-2 flex size-7 items-center justify-center rounded-md border shadow-sm">
            <GitPullRequestIcon className="size-4" aria-hidden />
            <span className="sr-only">{inFlightLabel}</span>
          </span>
        )}
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
