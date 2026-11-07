import { useQuery } from "@tanstack/react-query";
import {
  type InFlightFileRead,
  type InFlightRead,
  photosInFlightQuery,
  publishedPhotosQuery,
} from "@/api/photos";
import { EditInFlightPhoto } from "@/components/edit-in-flight";
import { QueryResult } from "@/components/query-result";

/** The Photo page's `?photo=`: the ID of a photo to edit, for pages that know a photo only by ID. */
export function photoIdSearch(search: Record<string, unknown>): { photo?: number } {
  const id = Number(search.photo);
  return Number.isInteger(id) && id > 0 ? { photo: id } : {};
}

/** The path of the photo file whose ID is id, among files; undefined when none has it. */
function pathOf(files: InFlightFileRead[], id: number): string | undefined {
  return files.find((file) => (file.data as { id?: unknown } | undefined)?.id === id)?.path;
}

/**
 * The photo editor for the photo with ID id, as the Trip Lines page opens it: its file in the
 * photo data pull request when it's there, or else the one already in the portfolio.
 */
export function EditPhotoById({ id }: { id: number }) {
  const inFlight = useQuery(photosInFlightQuery);
  return (
    <QueryResult query={inFlight} pendingLabel="Reading the pull request…">
      {(data) => <FindPhoto inFlight={data} id={id} />}
    </QueryResult>
  );
}

function FindPhoto({ inFlight, id }: { inFlight: InFlightRead; id: number }) {
  const path = pathOf(inFlight.files, id);
  const published = useQuery({ ...publishedPhotosQuery, enabled: path === undefined });
  if (path) return <EditInFlightPhoto path={path} />;
  return (
    <QueryResult query={published} pendingLabel="Finding the photo's file…">
      {(data) => <FoundOnBase path={pathOf(data.files, id)} id={id} />}
    </QueryResult>
  );
}

function FoundOnBase({ path, id }: { path?: string; id: number }) {
  if (!path) return <p className="text-destructive">No photo file has the ID {id}.</p>;
  return <EditInFlightPhoto path={path} from="gallery" />;
}
