import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { type PublishedFile, publishedPhotosQuery, type PublishedResponse } from "@/api/photos";
import { DraftSortToggle, parseDraftSort, sortDrafts } from "@/components/draft-sort";
import { DraftsSkeleton } from "@/components/in-flight-loading";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import { DraftTile, UndecidedQueue } from "@/components/undecided-photos";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";
import { undecidedPaths } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

interface SavedDraftsProps {
  /** Whether photos are in flight too: these drafts' Undecided panel is named after the branch to tell it apart from theirs. */
  alongside?: boolean;
}

/** The prefix the drafts' filters are kept under in the URL, such as `?draftPlace=with`. */
export const DRAFT_FILTERS = "draft";

/**
 * The drafts already on the base branch and not in flight (photos without a title, which
 * ALLPHOTOS.json leaves out), in an Undecided queue or a list of drafts, so they can be named
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
        None: every photo on {branch} has a title, or is in flight above.
      </p>
    </section>
  );
}

/** Whether the file is a draft on the base branch that the pull request doesn't change. */
function isBaseDraft(file: PublishedFile): boolean {
  return !file.error && !file.inFlight && isDraft(file.data);
}

function DraftsOnBase({ data, alongside }: SavedDraftsProps & { data: PublishedResponse }) {
  const edits = useLocalEditsStore((s) => s.edits);
  const { filters, filter } = usePhotoFilters(DRAFT_FILTERS);
  const sort = useSearch({ strict: false, select: parseDraftSort });
  const all = data.files.filter(isBaseDraft);
  if (all.length === 0) return <NoDrafts branch={data.branch} />;
  const drafts = sortDrafts(filter(all), sort);
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
        shown={drafts.length}
        total={all.length}
        prefix={DRAFT_FILTERS}
      >
        <DraftSortToggle sort={sort} />
      </PhotoFilterBar>
      <UndecidedQueue
        files={drafts.filter((file) => undecided.has(file.path))}
        images={data.images}
        fromGallery
        title={undecidedTitle(data.branch, alongside)}
      />
      <DraftList files={drafts.filter((file) => !undecided.has(file.path))} data={data} />
    </section>
  );
}

/** The base branch's Undecided panel heading: named after the branch beside the photos in flight. */
function undecidedTitle(branch: string, alongside?: boolean): string | undefined {
  return alongside ? `Undecided on ${branch}` : undefined;
}

/** The drafts on the base branch that aren't Undecided, as tiles; nothing when there are none. */
function DraftList({ files, data }: { files: PublishedFile[]; data: PublishedResponse }) {
  if (files.length === 0) return null;
  return (
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
  );
}
