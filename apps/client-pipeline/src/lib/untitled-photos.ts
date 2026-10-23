import type { InFlightFileRead, InFlightRead } from "@/api/photos";
import { titleOf } from "@/lib/drafts";

/** The title saved in the photo's JSON, or undefined without one. */
export function savedTitle(file: InFlightFileRead): string | undefined {
  return titleOf(file.data);
}

/** Whether the photo's JSON was read and has no title yet. */
function isUntitled(file: InFlightFileRead): boolean {
  return !file.error && savedTitle(file) === undefined;
}

/** files with the untitled photos first, each part keeping its order. */
export function untitledFirst<T extends InFlightFileRead>(files: T[]): T[] {
  return [...files.filter(isUntitled), ...files.filter((file) => !isUntitled(file))];
}

/**
 * The untitled photos that can be opened on the Photo page: not removed, with an image in R2, and
 * not in `skip`, such as the Undecided queue.
 */
export function editableUntitled(
  data: Pick<InFlightRead, "files" | "images">,
  skip: ReadonlySet<string> = new Set(),
): InFlightFileRead[] {
  const editable = (file: InFlightFileRead) =>
    file.status !== "removed" && Boolean(data.images.byPath[file.path]?.url);
  return data.files.filter((file) => isUntitled(file) && !skip.has(file.path) && editable(file));
}

/**
 * The path of the next untitled photo after `current` in the in-flight order, going back to the
 * first one after the last; the first one when no photo is open, skipping the ones in `skip`.
 * Undefined when there's none other than `current`.
 */
export function nextUntitledPath(
  data: Pick<InFlightRead, "files" | "images">,
  current?: string,
  skip?: ReadonlySet<string>,
): string | undefined {
  const order = data.files.map((file) => file.path);
  const at = current ? order.indexOf(current) : -1;
  const others = editableUntitled(data, skip).filter((file) => file.path !== current);
  const after = others.find((file) => order.indexOf(file.path) > at);
  return (after ?? others[0])?.path;
}
