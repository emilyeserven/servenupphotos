import { titleOf } from "@/lib/drafts";
import type { LocalEdit } from "@/stores/local-edits";

/** The photo JSON field marking a photo as Undecided: `true`, or left out (or `null`) when it isn't. */
export const UNDECIDED = "undecided";

/** A photo file as the Undecided queue reads it. */
interface PhotoFile {
  path: string;
  data?: unknown;
  error?: string;
}

/** The photo's data with its local edits made, as the next Commit will save it. */
export function editedData(file: PhotoFile, edits: Record<string, LocalEdit>): unknown {
  const fields = edits[file.path]?.fields;
  return fields ? { ...(file.data as object), ...fields } : file.data;
}

/**
 * Whether the photo is in the Undecided queue: marked `undecided` and still without a title, with
 * the local edits made. Giving it a title takes it out of the queue.
 */
function isUndecided(file: PhotoFile, edits: Record<string, LocalEdit>): boolean {
  const data = editedData(file, edits) as Record<string, unknown> | undefined;
  return !file.error && data?.[UNDECIDED] === true && titleOf(data) === undefined;
}

/** The paths of the photos in the Undecided queue. */
export function undecidedPaths(
  files: PhotoFile[],
  edits: Record<string, LocalEdit>,
): ReadonlySet<string> {
  return new Set(files.filter((file) => isUndecided(file, edits)).map((file) => file.path));
}
