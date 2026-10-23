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

/** The untitled photos that can be opened on the Photo page: not removed, and with an image in R2. */
export function editableUntitled(data: Pick<InFlightRead, "files" | "images">): InFlightFileRead[] {
  return data.files.filter(
    (file) => isUntitled(file) && file.status !== "removed" && data.images.byPath[file.path]?.url,
  );
}

/**
 * The path of the next untitled photo after `current` in the in-flight order, going back to the
 * first one after the last; the first one when no photo is open. Undefined when there's none
 * other than `current`.
 */
export function nextUntitledPath(
  data: Pick<InFlightRead, "files" | "images">,
  current?: string,
): string | undefined {
  const order = data.files.map((file) => file.path);
  const at = current ? order.indexOf(current) : -1;
  const others = editableUntitled(data).filter((file) => file.path !== current);
  const after = others.find((file) => order.indexOf(file.path) > at);
  return (after ?? others[0])?.path;
}
