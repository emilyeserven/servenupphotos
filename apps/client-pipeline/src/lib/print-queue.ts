import type { CombinedPhoto } from "@/lib/group-photos";
import { textOf } from "@portfolio/lib/values";

/** The photo's original file name, which the Printing pages know it by. */
export function photoKey(photo: CombinedPhoto): string {
  return textOf(photo.file);
}

/** The photo's title, or its file name when it has none. */
export function printPhotoName(photo: CombinedPhoto): string {
  return textOf(photo.title) || photoKey(photo);
}
