import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  type InFlightImages,
  type PublishedFile,
  publishedPhotosQuery,
  type PublishedResponse,
} from "@/api/photos";
import { CollapsiblePanel, countOf } from "@/components/collapsible-panel";
import { DraftSortToggle, parseDraftSort, sortDrafts } from "@/components/draft-sort";
import { DraftsSkeleton } from "@/components/in-flight-loading";
import { MissingImageDrafts } from "@/components/missing-image-drafts";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filter-bar";
import { DraftTile, UndecidedQueue } from "@/components/undecided-photos";
import { isDraft, isUnselected, useUntitledDrafts } from "@/lib/drafts";
import { editedData, undecidedPaths } from "@/lib/undecided";
import { type LocalEdit, useLocalEditsStore } from "@/stores/local-edits";

interface SavedDraftsProps {
  /** Whether photos are in flight too: these drafts' Undecided panel is named after the branch to tell it apart from theirs. */
  alongside?: boolean;
}

/** The prefix the drafts' filters are kept under in the URL, such as `?draftPlace=with`. */
export const DRAFT_FILTERS = "draft";

/**
 * The drafts already on the base branch and not in flight (photos without a title, which
 * ALLPHOTOS.json leaves out), leaving out the ones that lost in a compare group, in an Undecided queue or a list of drafts, so they can be named
 * from here, with their own filters and sort. Placeholders while they're read, and nothing when
 * untitled photos aren't kept as drafts.
 */
export function SavedDrafts(props: SavedDraftsProps) {
  const published = useQuery(publishedPhotosQuery);
  if (!useUntitledDrafts()) return null;
  if (published.isPending) return <DraftsSkeleton />;
  if (published.isError) return <DraftsError message={published.error.message} />;
  return <DraftsOnBase data={published.data} {...props} />;
}

/** Why the drafts on the base branch couldn't be read. */
function DraftsError({ message }: { message: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Drafts</h2>
      <p className="text-destructive text-sm">
        Couldn&apos;t read the drafts on the base branch: {message}
      </p>
    </section>
  );
}

/** The drafts heading with a note that the base branch has none, so the section doesn't just vanish. */
function NoDrafts({ branch }: { branch: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Drafts on {branch}</h2>
      <p className="text-muted-foreground text-sm">
        None: every photo on {branch} has a title, is in flight above, or is in Unselected Photos.
      </p>
    </section>
  );
}

/** Whether the file is a draft on the base branch that the pull request doesn't change. */
function isBaseDraft(file: PublishedFile): boolean {
  return !file.error && !file.inFlight && isDraft(file.data);
}

/**
 * Whether the draft lost in a compare group, with the local edits made: it's listed in Unselected
 * Photos on the Compare page instead.
 */
function lostInCompare(file: PublishedFile, edits: Record<string, LocalEdit>): boolean {
  return isUnselected(editedData(file, edits));
}

function DraftsOnBase({ data, alongside }: SavedDraftsProps & { data: PublishedResponse }) {
  const edits = useLocalEditsStore((s) => s.edits);
  const { filters, filter } = usePhotoFilters(DRAFT_FILTERS);
  const sort = useSearch({ strict: false, select: parseDraftSort });
  const all = data.files.filter((file) => isBaseDraft(file) && !lostInCompare(file, edits));
  if (all.length === 0) return <NoDrafts branch={data.branch} />;
  const [drafts, missing] = splitMissing(sortDrafts(filter(all), sort), data.images);
  const undecided = undecidedPaths(drafts, edits);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Drafts on {data.branch}</h2>
      <p className="text-muted-foreground text-sm">
        Photos saved without a title, so the portfolio doesn&apos;t show them. Edit one to name it;
        Commit then sends it to the “Add photo data” pull request.
      </p>
      <PhotoFilterBar
        filters={filters}
        shown={drafts.length + missing.length}
        total={all.length}
        prefix={DRAFT_FILTERS}
      >
        <DraftSortToggle sort={sort} />
      </PhotoFilterBar>
      <DraftList files={drafts.filter((file) => !undecided.has(file.path))} data={data} />
      <UndecidedQueue
        files={drafts.filter((file) => undecided.has(file.path))}
        images={data.images}
        fromGallery
        title={undecidedTitle(data.branch, alongside)}
      />
      <MissingImageDrafts files={missing} images={data.images} />
    </section>
  );
}

/**
 * The drafts that can be edited (their image is in R2), and the ones that can't, which are listed
 * apart so the main list only has drafts with Edit.
 */
function splitMissing(
  files: PublishedFile[],
  images: InFlightImages,
): [PublishedFile[], PublishedFile[]] {
  const missing = (file: PublishedFile) => images.byPath[file.path] === undefined;
  return [files.filter((file) => !missing(file)), files.filter(missing)];
}

/** The base branch's Undecided panel heading: named after the branch beside the photos in flight. */
function undecidedTitle(branch: string, alongside?: boolean): string | undefined {
  return alongside ? `Undecided on ${branch}` : undefined;
}

/**
 * The drafts on the base branch that can be edited and aren't Undecided, as tiles in a Drafts
 * panel, open at first and above the Undecided and Can't be edited ones; nothing when there are none.
 */
function DraftList({ files, data }: { files: PublishedFile[]; data: PublishedResponse }) {
  if (files.length === 0) return null;
  return (
    <CollapsiblePanel title="Drafts" count={countOf(files.length, "draft")} open>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {files.map((file) => (
          <DraftTile
            key={file.path}
            file={file}
            imageUrl={data.images.byPath[file.path]?.url}
            fromGallery
          />
        ))}
      </ul>
    </CollapsiblePanel>
  );
}
