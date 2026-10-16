import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { type BucketImage, bucketImagesQuery } from "@/api/photos";
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
            <BucketCard />
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

function BucketCard() {
  const bucket = useQuery(bucketImagesQuery);

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

      {bucket.data ? <BucketGrid images={bucket.data.images} /> : null}
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

function BucketGrid({ images }: { images: BucketImage[] }) {
  if (images.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <li key={image.key}>
          <BucketTile image={image} />
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

/** One image from the bucket, linking to its public URL, with its key, size and upload time. */
function BucketTile({ image }: { image: BucketImage }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="flex flex-col gap-1.5">
      <a href={image.url} target="_blank" rel="noreferrer">
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
            className="bg-muted aspect-square w-full rounded-xl border object-cover"
          />
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
