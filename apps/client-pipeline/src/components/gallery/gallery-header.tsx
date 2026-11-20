import { CheckIcon, ListChecksIcon, SearchIcon } from "lucide-react";
import type { InFlightImages, InFlightPullRequest, PublishedResponse } from "@/api/photos";
import type { GalleryFile } from "@/components/gallery/gallery-files";
import { OfflineNotice } from "@/components/offline-notice";
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
import { count } from "@portfolio/lib/words";

/** The base branch's read, with the images found in R2 for it and the pull request together. */
export interface GalleryRead {
  published: PublishedResponse;
  images: InFlightImages;
}

interface GalleryHeaderProps {
  /** The base branch's read and the images found in R2, once the base branch is read. */
  read?: GalleryRead;
  /** Every photo, base branch and pull request together, once read. */
  files: GalleryFile[];
  /** Whether either read is running again. */
  fetching: boolean;
  onRefresh: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  selecting: boolean;
  onSelectingChange: () => void;
}

/** The Gallery's card: where the photos are read from, how many, Select, Refresh and the search box. */
export function GalleryHeader(props: GalleryHeaderProps) {
  const { read } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio photos</CardTitle>
        <CardDescription>{describe(read?.published)}</CardDescription>
        <CardAction className="flex gap-2">
          <SelectButton on={props.selecting} disabled={!read} onClick={props.onSelectingChange} />
          <RefreshButton fetching={props.fetching} onClick={props.onRefresh} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {read && <Summary files={props.files} read={read} />}
        <label className="relative block max-w-sm">
          <span className="sr-only">Filter photos</span>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Filter by title or file name"
            value={props.filter}
            onChange={(e) => props.onFilterChange(e.target.value)}
            className="pl-9"
          />
        </label>
      </CardContent>
    </Card>
  );
}

/** Where the photos are read from, or that they're being read. */
function describe(published?: PublishedResponse): string {
  if (!published) return "Reading the photo JSON on the base branch.";
  return `${published.repo}, JSON in ${published.folder} on ${published.branch}, with the photos in flight over it`;
}

/** Reads the base branch and the pull request again. */
function RefreshButton({ fetching, onClick }: { fetching: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" disabled={fetching} onClick={onClick}>
      {fetching && <Spinner />}
      Refresh
    </Button>
  );
}

/** Turns choosing photos to add albums and tags to on, or off when it's on. */
function SelectButton({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={on ? "default" : "outline"}
      size="sm"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {on ? <CheckIcon /> : <ListChecksIcon />}
      {on ? "Done" : "Select"}
    </Button>
  );
}

/**
 * How many photos there are, and how many of them have changes in the pull request or waiting for
 * Commit, under the offline notice when R2 couldn't be reached.
 */
function Summary({ files, read }: { files: GalleryFile[]; read: GalleryRead }) {
  const { images, published } = read;
  const n = files.length;
  return (
    <>
      <OfflineNotice images={images} />
      <p className="text-muted-foreground">
        {count(n, "photo")}
        <InFlightCount files={files} pullRequest={published.pullRequest} />
        {r2Problem(images)}
      </p>
    </>
  );
}

/** Why R2 couldn't be checked, after the count; nothing when it was, or the offline notice says so. */
function r2Problem(images: InFlightImages): string {
  if (images.checked || images.offline) return "";
  return `. ${images.message ?? "Couldn't check R2."}`;
}

/** How many of the photos are new or changed since the base branch, linked to the pull request when one is open. */
function InFlightCount({
  files,
  pullRequest,
}: {
  files: GalleryFile[];
  pullRequest: InFlightPullRequest | null;
}) {
  const inFlight = files.filter((file) => file.inFlight).length;
  if (inFlight === 0) return null;
  if (!pullRequest) return <>; {inFlight} with changes waiting for Commit</>;
  return (
    <>
      ; {inFlight} with changes in{" "}
      <a
        href={pullRequest.url}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-4"
      >
        #{pullRequest.number}
      </a>
    </>
  );
}
