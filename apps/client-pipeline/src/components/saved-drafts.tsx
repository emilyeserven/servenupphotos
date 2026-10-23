import { useQuery } from "@tanstack/react-query";
import { type PublishedFile, publishedPhotosQuery, type PublishedResponse } from "@/api/photos";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import { DraftTile, UndecidedQueue } from "@/components/undecided-photos";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";
import { undecidedPaths } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

interface SavedDraftsProps {
  /**
   * Whether photos are in flight too: their list has the filter bar, and these drafts' Undecided
   * panel is named after the branch to tell it apart from theirs.
   */
  alongside?: boolean;
}

/**
 * The drafts already on the base branch and not in flight (photos without a title, which
 * ALLPHOTOS.json leaves out), in an Undecided queue or a list of drafts, so they can be named
 * from here, with the page's filters. Nothing when there are none, or when untitled photos aren't
 * kept as drafts.
 */
export function SavedDrafts(props: SavedDraftsProps) {
  const published = useQuery(publishedPhotosQuery);
  if (!useUntitledDrafts() || !published.data) return null;
  return <DraftsOnBase data={published.data} {...props} />;
}

/** Whether the file is a draft on the base branch that the pull request doesn't change. */
function isBaseDraft(file: PublishedFile): boolean {
  return !file.error && !file.inFlight && isDraft(file.data);
}

function DraftsOnBase({ data, alongside }: SavedDraftsProps & { data: PublishedResponse }) {
  const edits = useLocalEditsStore((s) => s.edits);
  const { filters, filter } = usePhotoFilters();
  const all = data.files.filter(isBaseDraft);
  if (all.length === 0) return null;
  const drafts = filter(all);
  const undecided = undecidedPaths(drafts, edits);
  const listed = drafts.filter((file) => !undecided.has(file.path));
  return (
    <>
      {!alongside && <PhotoFilterBar filters={filters} shown={drafts.length} total={all.length} />}
      <UndecidedQueue
        files={drafts.filter((file) => undecided.has(file.path))}
        images={data.images}
        fromGallery
        title={undecidedTitle(data.branch, alongside)}
      />
      <DraftList files={listed} data={data} />
    </>
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
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Drafts on {data.branch}</h2>
      <p className="text-muted-foreground text-sm">
        Photos saved without a title, so the portfolio doesn&apos;t show them. Edit one to name it;
        Commit then sends it to the “Add photo data” pull request.
      </p>
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
    </section>
  );
}
