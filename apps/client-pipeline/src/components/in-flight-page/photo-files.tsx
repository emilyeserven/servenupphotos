import { useSearch } from "@tanstack/react-router";
import {
  type InFlightFile,
  type InFlightImages,
  type InFlightResponse,
  type RemoveResult,
} from "@/api/photos";
import { CollapsiblePhotos } from "@/components/collapsible-photos";
import { EmptySection } from "@/components/in-flight-loading";
import { FileSection } from "@/components/in-flight-page/file-section";
import { InFlightSortToggle, sortInFlight } from "@/components/in-flight-sort";
import { OfflineNotice } from "@/components/offline-notice";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import { SavedDrafts } from "@/components/saved-drafts";
import { UndecidedQueue } from "@/components/undecided-photos";
import { undecidedPaths } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * The photo files that pass the filters, in the chosen sort (by default the ones without a title
 * first, so they're easy to find and name), after the Undecided queue, which takes the photos set aside out of the list, and
 * then the drafts already on the base branch that aren't in flight.
 */
export function PhotoFiles({
  shown,
  ...props
}: {
  shown?: InFlightResponse;
  rebuilding: boolean;
  baseBranch?: string;
  onRemoved: (result: RemoveResult) => void;
}) {
  const edits = useLocalEditsStore((s) => s.edits);
  const { filters, filter } = usePhotoFilters();
  const sort = useSearch({ from: "/in-flight", select: (search) => search.sort });
  if (!shown) return null;
  if (shown.files.length === 0) {
    return (
      <>
        <EmptySection title="No photos in flight">
          Photos saved from the Photo page wait here until Commit sends them to the “Add photo data”
          pull request.
        </EmptySection>
        <SavedDrafts />
      </>
    );
  }
  const files = filter(shown.files);
  const undecided = undecidedPaths(files, edits);
  return (
    <>
      <OfflineNotice images={shown.images} />
      <PhotoFilterBar filters={filters} shown={files.length} total={shown.files.length}>
        <InFlightSortToggle sort={sort} />
      </PhotoFilterBar>
      <UndecidedQueue
        files={files.filter((file) => undecided.has(file.path))}
        images={shown.images}
      />
      <InFlightList
        files={sortInFlight(
          files.filter((file) => !undecided.has(file.path)),
          sort,
        )}
        images={shown.images}
        {...props}
      />
      <SavedDrafts alongside />
    </>
  );
}

/** The photos in flight, each with its image and JSON, in a section that collapses. */
function InFlightList({
  files,
  ...props
}: {
  files: InFlightFile[];
  images: InFlightImages;
  rebuilding: boolean;
  baseBranch?: string;
  onRemoved: (result: RemoveResult) => void;
}) {
  return (
    <CollapsiblePhotos count={files.length}>
      {files.map((file) => (
        <FileSection key={file.path} file={file} {...props} />
      ))}
    </CollapsiblePhotos>
  );
}
