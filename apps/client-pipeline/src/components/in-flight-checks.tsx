import { ChevronRightIcon } from "lucide-react";
import type {
  CombinedFile,
  InFlightFile,
  InFlightGroups,
  InFlightImages,
  InFlightResponse,
} from "@/api/photos";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";

/** The last part of a file's path, such as `night-market.json`. */
export function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** How many album, tag, place or localization files the pull request has, and how its combined file matches them. */
function groupsSummary(groups: InFlightGroups): string {
  const count = groups.files.length;
  const files = count === 0 ? "None" : String(count);
  const all = groups.all;
  const allFile = fileName(all.path);
  if (!all.found) return `${files}; ${allFile} not on the branch yet`;
  if (all.error) return `${files}; ${allFile}: ${all.error}`;
  const matched = groups.files.filter((file) => file.inAll).length;
  return `${files}; ${allFile} lists ${all.count}, ${matched} of ${count} match`;
}

/**
 * How many entries ALLPHOTOS.json has and how many of the photo files match one, leaving out the
 * drafts, which it doesn't list, when untitled photos are kept as drafts.
 */
function AllPhotosSummary({ all, files }: { all: CombinedFile; files: InFlightFile[] }) {
  const listed = useUntitledDrafts() ? files.filter((file) => !isDraft(file.data)) : files;
  if (!all.found) return "Not on the branch yet. Commit adds it.";
  if (all.error) return all.error;
  const matched = listed.filter((file) => file.inAllPhotos).length;
  const drafts = files.length - listed.length;
  return `Lists ${all.count}; ${matched} of ${listed.length} photo files match${draftsLeftOut(drafts)}`;
}

/** ", N drafts left out" after the ALLPHOTOS.json summary, when there are any. */
function draftsLeftOut(drafts: number): string {
  if (drafts === 0) return "";
  return `, ${drafts} ${drafts === 1 ? "draft" : "drafts"} left out`;
}

/** How many of the photo files' images were found in R2, or why R2 couldn't be checked. */
function imagesSummary(images: InFlightImages, files: number): string {
  if (!images.checked) return images.message ?? "Couldn't check R2.";
  return `${Object.keys(images.byPath).length} of ${files} found in R2`;
}

/**
 * How the pull request's files match ALLPHOTOS.json and the other combined files, and how many
 * images R2 has, collapsed to a one-line summary until it's opened.
 */
export function FileChecks({ data }: { data: InFlightResponse }) {
  return (
    <details className="group">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="size-4 transition-transform group-open:rotate-90"
          aria-hidden
        />
        ALLPHOTOS.json, images and the other data files
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-muted-foreground">ALLPHOTOS.json</dt>
        <dd>
          <AllPhotosSummary all={data.allPhotos} files={data.files} />
        </dd>
        <dt className="text-muted-foreground">Images</dt>
        <dd>{imagesSummary(data.images, data.files.length)}</dd>
        <dt className="text-muted-foreground">Album files</dt>
        <dd>{groupsSummary(data.albums)}</dd>
        <dt className="text-muted-foreground">Tag files</dt>
        <dd>{groupsSummary(data.tags)}</dd>
        <dt className="text-muted-foreground">Genre files</dt>
        <dd>{groupsSummary(data.genres)}</dd>
        <dt className="text-muted-foreground">Place files</dt>
        <dd>{groupsSummary(data.places)}</dd>
        <dt className="text-muted-foreground">Localization files</dt>
        <dd>{groupsSummary(data.localizations)}</dd>
        <dt className="text-muted-foreground">Metadata group files</dt>
        <dd>{groupsSummary(data.metainfo)}</dd>
        <dt className="text-muted-foreground">Camera override files</dt>
        <dd>{groupsSummary(data.cameras)}</dd>
        <dt className="text-muted-foreground">Custom lens files</dt>
        <dd>{groupsSummary(data.lenses)}</dd>
      </dl>
    </details>
  );
}
