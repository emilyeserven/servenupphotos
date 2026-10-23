import { useQuery } from "@tanstack/react-query";
import { publishedPhotosQuery, type PublishedResponse } from "@/api/photos";
import { DraftTile, UndecidedQueue } from "@/components/undecided-photos";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";
import { undecidedPaths } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * With nothing in flight, the drafts already on the base branch (photos without a title, which
 * ALLPHOTOS.json leaves out), in the Undecided queue or a list of drafts, so they can be named
 * from here. Nothing when there are none, or when untitled photos aren't kept as drafts.
 */
export function SavedDrafts() {
  const published = useQuery(publishedPhotosQuery);
  if (!useUntitledDrafts() || !published.data) return null;
  return <DraftsOnBase data={published.data} />;
}

function DraftsOnBase({ data }: { data: PublishedResponse }) {
  const edits = useLocalEditsStore((s) => s.edits);
  const drafts = data.files.filter((file) => !file.error && isDraft(file.data));
  if (drafts.length === 0) return null;
  const undecided = undecidedPaths(drafts, edits);
  const listed = drafts.filter((file) => !undecided.has(file.path));
  return (
    <>
      <UndecidedQueue
        files={drafts.filter((file) => undecided.has(file.path))}
        images={data.images}
        fromGallery
      />
      {listed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Drafts on {data.branch}</h2>
          <p className="text-muted-foreground text-sm">
            Photos saved without a title, so the portfolio doesn&apos;t show them. Edit one to name
            it; Commit then sends it to a new “Add photo data” pull request.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {listed.map((file) => (
              <DraftTile
                key={file.path}
                file={file}
                imageUrl={data.images.byPath[file.path]?.url}
                fromGallery
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
