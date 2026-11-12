import type { SanitizedExif } from "@/api/exif";
import type { PhotoGroups } from "@/api/organize";
import type { PhotoData } from "@/api/photos";

/**
 * The body Save sends for a new photo: its places and its "no GPS on purpose" box, which the Photo
 * page keeps on the sanitized EXIF, go next to the albums and tags, where the backend takes them.
 * The backend refuses a sanitized EXIF with fields it doesn't know.
 */
export function photoData(
  name: string,
  file: string,
  sanitized: SanitizedExif,
  groups: PhotoGroups,
): PhotoData {
  const { places = [], noGps = false, ...exif } = sanitized;
  return { name, file, sanitized: exif, ...groups, places, noGps };
}
