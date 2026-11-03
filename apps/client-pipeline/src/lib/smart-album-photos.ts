import type { Group } from "@portfolio/lib/groups";
import { type Photo, photosFromData } from "@portfolio/lib/photos";
import { isSmartAlbum } from "@portfolio/lib/smart-albums";
import type { TimelineLabel } from "@portfolio/lib/timeline-labels";
import type { CombinedFiles } from "@/api/photos";
import type { CombinedPhoto } from "@/lib/group-photos";

/** A photo JSON entry as the portfolio reads it. */
type PhotoData = Parameters<typeof photosFromData>[0][number];

/** The ID an entry goes by here: its own, or a negative one when it has none or shares one. */
function uniqueId(id: unknown, index: number, seen: Set<number>): number {
  const own = typeof id === "number" && !seen.has(id) ? id : -(index + 1);
  seen.add(own);
  return own;
}

/** The objects in a combined list, such as ALLALBUMS.json's albums. */
function listOf<T>(data: unknown[] | undefined): T[] {
  return (data ?? []).filter((item) => typeof item === "object" && item !== null) as T[];
}

/** The timeline labels in the combined lists, for the Smart Albums' label rules. */
export function labelsOf(files: Pick<CombinedFiles, "timeline">): TimelineLabel[] {
  return listOf<TimelineLabel>(files.timeline.data);
}

/** ALLPHOTOS.json's entries as the portfolio reads them, and which entry each photo is, by its ID. */
interface ReadEntries {
  photos: Photo[];
  ids: number[];
}

/**
 * The entries as the portfolio reads them, in the Smart Albums of albums their rules match (the
 * portfolio's own albums and timeline labels when left out), and the ID each entry goes by.
 */
export function readEntries(
  entries: CombinedPhoto[],
  albums?: Group[],
  labels?: TimelineLabel[],
): ReadEntries {
  const seen = new Set<number>();
  const ids = entries.map((entry, index) => uniqueId(entry.id, index, seen));
  const data = entries.map((entry, index) => ({ ...entry, id: ids[index] }) as PhotoData);
  return { photos: photosFromData(data, albums, labels), ids };
}

/**
 * ALLPHOTOS.json's entries, each with the IDs of the Smart Albums whose rules it matches added to
 * its `albums`, using the albums and timeline labels in the same combined lists (with the changes
 * waiting for Commit), so a Smart Album's page and counts follow its rules as soon as they're
 * saved. The portfolio does the same with its own data when it's built. An entry with no date
 * can't be placed in time, so it's in no Smart Album.
 */
export function withSmartAlbumEntries(
  entries: CombinedPhoto[],
  files: Pick<CombinedFiles, "albums" | "timeline">,
): CombinedPhoto[] {
  const albums = listOf<Group>(files.albums.data);
  if (!albums.some(isSmartAlbum)) return entries;
  const { photos, ids } = readEntries(entries, albums, labelsOf(files));
  const read = new Map(photos.map((photo) => [photo.id, photo.albums]));
  return entries.map((entry, index) => withAlbums(entry, read.get(ids[index] as number)));
}

/** The entry with albums as its `albums`, or as it is when it has no more than it lists. */
function withAlbums(entry: CombinedPhoto, albums: string[] | undefined): CombinedPhoto {
  const own = Array.isArray(entry.albums) ? entry.albums.length : 0;
  return albums && albums.length > own ? { ...entry, albums } : entry;
}
