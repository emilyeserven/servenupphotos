import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ImageOffIcon, RefreshCwIcon, TriangleAlertIcon, XIcon, ZapIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useMemo, useState } from "react";
import { type BucketImage, bucketImagesQuery } from "@/api/photos";
import { r2IsSetUp, settingsQuery } from "@/api/settings";
import { VERSIONS, type VersionName, regenerateVersionsMutation } from "@/api/versions";
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

export const Route = createFileRoute("/sizes")({
  component: SizesPage,
  staticData: { wide: true },
});

function SizesPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
      title="Manage Sizes"
      description="Every photo in the R2 bucket and its resized versions. Make a missing size, or remake one from the original."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          r2IsSetUp(data.r2) ? (
            <SizesCard />
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

/** An original JPEG the pipeline uploaded, and which of its resized versions are in the bucket. */
interface PhotoRow {
  original: BucketImage;
  /** The name the photo was uploaded under, without the key's folder and hash. */
  name: string;
  versions: Partial<Record<VersionName, BucketImage>>;
}

/** The keys the backend writes originals at, capturing the name: photos/<hash>-<name>.jpg. */
const originalKeyPattern = /^photos\/[0-9a-f]{12}(?:-([a-z0-9-]+))?\.jpg$/;

/** Each original in the listing, in its order, with the versions found next to it. */
function photoRows(images: BucketImage[]): PhotoRow[] {
  const byKey = new Map(images.map((image) => [image.key, image]));
  return images.flatMap((image) => photoRow(image, byKey) ?? []);
}

function photoRow(original: BucketImage, byKey: Map<string, BucketImage>): PhotoRow | undefined {
  const match = originalKeyPattern.exec(original.key);
  if (!match) return undefined;
  const stem = original.key.slice(0, -".jpg".length);
  const versions: PhotoRow["versions"] = {};
  for (const version of VERSIONS) {
    versions[version.name] = byKey.get(`${stem}-${version.name}.webp`);
  }
  return { original, name: `${match[1] ?? "(no name)"}.jpg`, versions };
}

function SizesCard() {
  const bucket = useQuery(bucketImagesQuery);
  const rows = useMemo(() => photoRows(bucket.data?.images ?? []), [bucket.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sizes</CardTitle>
        <CardDescription>
          {bucket.data ? sizesSummary(rows) : "Listing the bucket from Settings."}
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
      <CardContent>
        <QueryResult query={bucket} pendingLabel="Listing images in R2…">
          {() =>
            rows.length > 0 ? (
              <SizesTable rows={rows} />
            ) : (
              <p className="text-muted-foreground">No uploaded photos in this bucket yet.</p>
            )
          }
        </QueryResult>
      </CardContent>
    </Card>
  );
}

/** How many photos there are and how many sizes they're missing. */
function sizesSummary(rows: PhotoRow[]): string {
  const photos = rows.length === 1 ? "1 photo" : `${rows.length} photos`;
  const missing = rows.reduce(
    (sum, row) => sum + VERSIONS.filter((v) => !row.versions[v.name]).length,
    0,
  );
  if (missing === 0) return `${photos}, every size made.`;
  return `${photos}, ${missing === 1 ? "1 size" : `${missing} sizes`} not made yet.`;
}

function SizesTable({ rows }: { rows: PhotoRow[] }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-4 font-medium">
              Image
            </th>
            {VERSIONS.map((version) => (
              <th key={version.name} scope="col" className="px-2 py-2 text-center font-medium">
                <span className="block">{version.label}</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  {version.maxEdge}px
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SizesRow key={row.original.key} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Makes versions of one photo, then lists the bucket again so the table shows them. */
function useRegenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    ...regenerateVersionsMutation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bucketImagesQuery.queryKey }),
  });
}

function SizesRow({ row }: { row: PhotoRow }) {
  const all = useRegenerate();
  return (
    <tr className="group border-b last:border-b-0">
      <th scope="row" className="py-2 pr-4 text-left font-normal">
        <div className="flex items-center gap-3">
          <Thumbnail row={row} />
          <div className="flex min-w-0 items-center gap-1">
            <ActionButton
              pending={all.isPending}
              error={all.error}
              idleIcon={<RefreshCwIcon />}
              label={`Remake every size of ${row.name}`}
              title="Remake every size from the original"
              // Shown on hovering the row (always on touch screens), and kept while it works or after it fails.
              className={cn(
                "size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
                !all.isIdle && !all.isSuccess && "opacity-100",
              )}
              onClick={() => all.mutate({ key: row.original.key })}
            />
            <a
              href={row.original.url}
              target="_blank"
              rel="noreferrer"
              title={row.original.key}
              className="max-w-64 truncate font-mono text-xs hover:underline"
            >
              {row.name}
            </a>
          </div>
        </div>
      </th>
      {VERSIONS.map((version) => (
        <td key={version.name} className="px-2 py-2 text-center">
          <SizeCell
            row={row}
            version={version.name}
            label={version.label}
            rowPending={all.isPending}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * The photo's smallest version, at most 50px tall, or a placeholder when it hasn't been made. A
 * fixed-width box keeps the names lined up whatever shape the photo is. Clicking it opens the
 * Medium (1200px) version, or the original when there's no Medium yet.
 */
function Thumbnail({ row }: { row: PhotoRow }) {
  const [open, setOpen] = useState(false);
  const large = largeView(row);
  return (
    <>
      <button
        type="button"
        title={`Show the ${large.label}`}
        onClick={() => setOpen(true)}
        className="focus-visible:ring-ring flex h-[50px] w-[75px] shrink-0 cursor-zoom-in items-center justify-center rounded-md outline-none focus-visible:ring-2"
      >
        <ThumbnailImage key={row.versions.xsmall?.url} image={row.versions.xsmall} />
        <span className="sr-only">Show {row.name} larger</span>
      </button>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        title={`${row.name} · ${large.label}`}
        image={large.image}
      />
    </>
  );
}

/** What clicking a thumbnail shows: the Medium version, or the original until there is one. */
function largeView(row: PhotoRow): { image: BucketImage; label: string } {
  if (row.versions.medium) return { image: row.versions.medium, label: "Medium (1200px) version" };
  return { image: row.original, label: "original" };
}

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  title: string;
  image: BucketImage;
}

/** A full-window overlay showing one image from the bucket, scaled down only to fit the window. */
function ImageLightbox({ open, onClose, title, image }: ImageLightboxProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/95" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col text-white outline-none">
          <div className="flex items-center gap-4 p-4">
            <Dialog.Title className="flex-1 truncate font-medium">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{image.key} at full size.</Dialog.Description>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <XIcon />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
            <img src={freshUrl(image)} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ThumbnailImage({ image }: { image?: BucketImage }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div
        title={image ? "Couldn't load the X-Small version" : "No X-Small version yet"}
        className="bg-muted/40 text-muted-foreground flex size-[50px] items-center justify-center rounded-md border border-dashed"
      >
        <ImageOffIcon className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={freshUrl(image)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="bg-muted max-h-[50px] max-w-[75px] rounded-md border"
    />
  );
}

/** The image's URL, changed whenever it's remade so the browser fetches the new one, not its cache. */
function freshUrl(image: BucketImage): string {
  return `${image.url}?v=${encodeURIComponent(image.modified)}`;
}

interface SizeCellProps {
  row: PhotoRow;
  version: VersionName;
  label: string;
  /** Whether every size of the row is being remade, which includes this one. */
  rowPending: boolean;
}

/** How a size's button looks when the size exists (remake) and when it doesn't (make). */
const sizeActions = {
  remake: { verb: "Remake", icon: <RefreshCwIcon />, className: "size-8" },
  make: {
    verb: "Make",
    icon: <ZapIcon />,
    className: "size-8 text-amber-500 hover:text-amber-600",
  },
};

/** Remakes one size of a photo when it exists, or makes it for the first time when it doesn't. */
function SizeCell({ row, version, label, rowPending }: SizeCellProps) {
  const one = useRegenerate();
  const look = row.versions[version] ? sizeActions.remake : sizeActions.make;
  const action = `${look.verb} the ${label} size`;
  return (
    <ActionButton
      pending={one.isPending || rowPending}
      error={one.error}
      idleIcon={look.icon}
      label={`${action} of ${row.name}`}
      title={action}
      className={look.className}
      onClick={() => one.mutate({ key: row.original.key, versions: [version] })}
    />
  );
}

interface ActionButtonProps {
  pending: boolean;
  error: Error | null;
  /** The icon shown while nothing is happening. */
  idleIcon: ReactNode;
  label: string;
  title: string;
  className: string;
  onClick: () => void;
}

/** An icon button that spins while it works and shows a warning, titled with why, if it failed. */
function ActionButton({
  pending,
  error,
  idleIcon,
  label,
  title,
  className,
  onClick,
}: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      disabled={pending}
      aria-label={label}
      title={error?.message ?? title}
      onClick={onClick}
    >
      {actionIcon(pending, error, idleIcon)}
    </Button>
  );
}

function actionIcon(pending: boolean, error: Error | null, idleIcon: ReactNode): ReactNode {
  if (pending) return <Spinner />;
  if (error) return <TriangleAlertIcon className="text-destructive" />;
  return idleIcon;
}
