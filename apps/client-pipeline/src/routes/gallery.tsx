import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { GitPullRequestArrowIcon, ImageOffIcon, PencilIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import {
  type InFlightImages,
  type PublishedFile,
  type PublishedResponse,
  publishedPhotosQuery,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { squareThumbnailUrl, thumbnailPreviewUrl } from "@/api/versions";
import { ImageLightbox } from "@/components/image-lightbox";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  staticData: { wide: true },
});

function GalleryPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      wide
      title="Gallery"
      description="Photos already in the portfolio. Editing one saves the change to the “Add photo data” pull request, where it waits in Photos in Flight until it merges."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <PublishedPhotos />
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

function PublishedPhotos() {
  const published = useQuery(publishedPhotosQuery);
  const [filter, setFilter] = useState("");
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio photos</CardTitle>
          <CardDescription>
            {published.data
              ? `${published.data.repo}, JSON in ${published.data.folder} on ${published.data.branch}`
              : "Reading the photo JSON on the base branch."}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={published.isFetching}
              onClick={() => void published.refetch()}
            >
              {published.isFetching && <Spinner />}
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {published.data && <Summary data={published.data} />}
          <label className="relative block max-w-sm">
            <span className="sr-only">Filter photos</span>
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Filter by title or file name"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </label>
        </CardContent>
      </Card>
      <QueryResult query={published} pendingLabel="Reading the portfolio's photos from GitHub…">
        {(data) => <PhotoGrid data={data} filter={filter} />}
      </QueryResult>
    </>
  );
}

/** How many photos there are, and how many of them have changes waiting in the pull request. */
function Summary({ data }: { data: PublishedResponse }) {
  const count = data.files.length;
  return (
    <p className="text-muted-foreground">
      {count === 1 ? "1 photo" : `${count} photos`}
      <InFlightCount data={data} />
      {!data.images.checked && `. ${data.images.message ?? "Couldn't check R2."}`}
    </p>
  );
}

/** How many of the photos the pull request changes, linked to it, when it changes any. */
function InFlightCount({ data }: { data: PublishedResponse }) {
  const inFlight = data.files.filter((file) => file.inFlight).length;
  if (!data.pullRequest || inFlight === 0) return null;
  return (
    <>
      ; {inFlight} with changes in{" "}
      <a
        href={data.pullRequest.url}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-4"
      >
        #{data.pullRequest.number}
      </a>
    </>
  );
}

function PhotoGrid({ data, filter }: { data: PublishedResponse; filter: string }) {
  if (data.files.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        No photo JSON on {data.branch} yet. Photos show here once their pull request merges.
      </p>
    );
  }
  const shown = sortedNewestFirst(data.files).filter((file) => matches(file, filter));
  if (shown.length === 0) {
    return <p className="text-muted-foreground text-sm">No photos match “{filter.trim()}”.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-4">
      {shown.map((file) => (
        <li key={file.path}>
          <PhotoCard file={file} images={data.images} />
        </li>
      ))}
    </ul>
  );
}

function PhotoCard({ file, images }: { file: PublishedFile; images: InFlightImages }) {
  const image = images.byPath[file.path];
  const name = photoName(file);
  const problem = editProblem(file, images);
  return (
    <article className="bg-card flex h-full flex-col overflow-hidden rounded-xl border">
      <SquareTile file={file} name={name} imageUrl={image?.url} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium" title={name}>
            {name}
          </h2>
          <a
            href={file.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground block truncate font-mono text-xs underline-offset-4 hover:underline"
          >
            {fileName(file.path)}
          </a>
        </div>
        <InFlightMark status={file.inFlight} />
        <div className="mt-auto flex items-center gap-2">
          {problem ? (
            <p className="text-muted-foreground text-xs">{problem}</p>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/exif" search={{ edit: file.path, from: "gallery" }}>
                <PencilIcon />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Why the photo can't be opened on the Photo page, or undefined when it can. */
function editProblem(file: PublishedFile, images: InFlightImages): string | undefined {
  if (file.error) return file.error;
  if (file.inFlight === "removed") return "Removed in the pull request.";
  return imageProblem(file, images);
}

/** Why the photo has no image in R2 to edit from, or undefined when it has one. */
function imageProblem(file: PublishedFile, images: InFlightImages): string | undefined {
  if (images.byPath[file.path]) return undefined;
  return images.checked ? "No image in R2 to edit from." : "Couldn't check R2 for its image.";
}

const IN_FLIGHT_LABELS: Record<string, string> = {
  removed: "Removed in flight",
};

/** A note, linked to Photos in Flight, when the pull request changes the photo. */
function InFlightMark({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <Link
      to="/in-flight"
      className={cn(
        "flex w-fit items-center gap-1 text-xs underline-offset-4 hover:underline",
        status === "removed" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
      )}
    >
      <GitPullRequestArrowIcon className="size-3.5" aria-hidden />
      {IN_FLIGHT_LABELS[status] ?? "Changes in flight"}
    </Link>
  );
}

/** The photo's Square Thumbnail, over its blurred Thumbnail Preview, opening the photo full size. */
function SquareTile({
  file,
  name,
  imageUrl,
}: {
  file: PublishedFile;
  name: string;
  imageUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const urls = tileUrls(file, imageUrl);
  if (!urls || failed) return <MissingTile />;
  return (
    <>
      <button
        type="button"
        title="Show it full size"
        onClick={() => setOpen(true)}
        className="focus-visible:ring-ring bg-muted relative aspect-square w-full cursor-zoom-in overflow-hidden border-b outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <img
          src={urls.preview}
          alt=""
          aria-hidden
          // Photos uploaded before Thumbnail Previews don't have one, so it hides itself.
          onError={(e) => (e.currentTarget.hidden = true)}
          className="absolute inset-0 size-full scale-110 object-cover blur-md"
        />
        <img
          src={urls.square}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="relative size-full object-cover"
        />
      </button>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        src={urls.full}
        description={`${name} at full size.`}
      />
    </>
  );
}

function MissingTile() {
  return (
    <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 border-b text-xs">
      <ImageOffIcon className="size-6" aria-hidden />
      No image
    </div>
  );
}

/**
 * The tile's Square Thumbnail and Thumbnail Preview, as saved in the photo's JSON or else next to
 * its image in R2, and the image itself; undefined without an image in R2.
 */
function tileUrls(file: PublishedFile, imageUrl?: string) {
  if (!imageUrl) return undefined;
  return {
    square: savedImageUrl(file, "thumbnail") ?? squareThumbnailUrl(imageUrl),
    preview: savedImageUrl(file, "thumbnailpreview") ?? thumbnailPreviewUrl(imageUrl),
    full: imageUrl,
  };
}

function savedImageUrl(file: PublishedFile, name: string): string | undefined {
  const saved = (file.data as { images?: Record<string, unknown> } | undefined)?.images?.[name];
  return typeof saved === "string" && saved ? saved : undefined;
}

function savedString(file: PublishedFile, field: string): string | undefined {
  const value = (file.data as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** What to call the photo: its title, or else its original file name. */
function photoName(file: PublishedFile): string {
  return savedString(file, "title") ?? file.photoName;
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Whether the photo's title or file names contain filter, ignoring case. */
function matches(file: PublishedFile, filter: string): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  return [photoName(file), file.photoName, fileName(file.path)].some((text) =>
    text.toLowerCase().includes(query),
  );
}

/** files by when each photo was taken, newest first, then ones without a date by path. */
function sortedNewestFirst(files: PublishedFile[]): PublishedFile[] {
  return files.toSorted((a, b) => {
    const da = savedString(a, "createDate") ?? "";
    const db = savedString(b, "createDate") ?? "";
    if (da !== db) return db.localeCompare(da);
    return a.path.localeCompare(b.path);
  });
}
