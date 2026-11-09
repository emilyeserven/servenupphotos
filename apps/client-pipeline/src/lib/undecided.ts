import { isSetAside } from "@/lib/drafts";
import type { LocalEdit } from "@/stores/local-edits";

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
 * Whether the photo is in the Undecided queue: marked `undecided`, with the local edits made,
 * whether it has a title or not. Moving it back, or naming an untitled one on the Photo page, takes
 * it out of the queue.
 */
function isUndecided(file: PhotoFile, edits: Record<string, LocalEdit>): boolean {
  return !file.error && isSetAside(editedData(file, edits));
}

/** The paths of the photos in the Undecided queue. */
export function undecidedPaths(
  files: PhotoFile[],
  edits: Record<string, LocalEdit>,
): ReadonlySet<string> {
  return new Set(files.filter((file) => isUndecided(file, edits)).map((file) => file.path));
}
