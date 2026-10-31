import type {
  InFlightFileRead,
  InFlightImages,
  InFlightRead,
  PublishedResponse,
} from "@/api/photos";
import { editedData } from "@/lib/undecided";
import type { LocalEdit } from "@/stores/local-edits";

/** The photo JSON field naming the compare group a photo is in, or left out (or `null`) when it's in none. */
export const COMPARE_GROUP = "compareGroup";

/** The photo JSON field marking a photo picked as one of its compare group's winners: `true`, or left out. */
export const COMPARE_WINNER = "compareWinner";

/** A photo that can go in a compare group, from the Gallery or Photos in Flight. */
export interface ComparePhoto {
  /** The photo's file as read, before local edits. */
  file: InFlightFileRead;
  /** The photo's data with its local edits made, as the next Commit will save it. */
  data: Record<string, unknown>;
  /** The photo's image in R2, when it has one. */
  imageUrl?: string;
  /** True for a photo on the base branch the pull request doesn't change, which the Photo page opens as the Gallery does. */
  fromGallery: boolean;
}

/** A compare group: its name and its photos, in name order. */
export interface CompareGroup {
  name: string;
  photos: ComparePhoto[];
}

/** The compare group named in the photo's data, trimmed, or undefined when it's in none. */
export function compareGroupOf(data: unknown): string | undefined {
  const group = (data as Record<string, unknown> | null | undefined)?.[COMPARE_GROUP];
  return typeof group === "string" && group.trim() ? group.trim() : undefined;
}

/** Whether the photo is picked as one of its compare group's winners. */
export function isWinner(photo: ComparePhoto): boolean {
  return photo.data[COMPARE_WINNER] === true;
}

/** Whether the file can go in a compare group: its JSON was read and it isn't being removed. */
export function canCompare(file: InFlightFileRead & { inFlight?: string }): boolean {
  return !file.error && file.status !== "removed" && file.inFlight !== "removed";
}

/** The file as a photo to compare, with its local edits made and its image from images. */
function comparePhoto(
  file: InFlightFileRead,
  images: InFlightImages,
  edits: Record<string, LocalEdit>,
  fromGallery: boolean,
): ComparePhoto {
  const data = (editedData(file, edits) ?? {}) as Record<string, unknown>;
  return { file, data, imageUrl: images.byPath[file.path]?.url, fromGallery };
}

/** The files of the read that can be compared, as photos to compare. */
function readPhotos(
  read: { files: InFlightFileRead[]; images: InFlightImages },
  edits: Record<string, LocalEdit>,
  fromGallery: boolean,
): ComparePhoto[] {
  return read.files
    .filter(canCompare)
    .map((file) => comparePhoto(file, read.images, edits, fromGallery));
}

const NOTHING_READ = { files: [], images: { checked: false, byPath: {} } };

/**
 * Every photo that can be compared: the ones in flight, then the ones on the base branch the pull
 * request doesn't change, each with its local edits made.
 */
export function comparePhotos(
  published: PublishedResponse | undefined,
  inFlight: InFlightRead | undefined,
  edits: Record<string, LocalEdit>,
): ComparePhoto[] {
  const flying = inFlight ?? NOTHING_READ;
  const paths = new Set(flying.files.map((file) => file.path));
  const base = published ?? NOTHING_READ;
  const unchanged = { ...base, files: base.files.filter((file) => !paths.has(file.path)) };
  return [...readPhotos(flying, edits, false), ...readPhotos(unchanged, edits, true)];
}

/** What to call the photo: its title, or else its original file name. */
export function comparePhotoName(photo: ComparePhoto): string {
  const title = photo.data.title;
  return typeof title === "string" && title.trim() ? title.trim() : photo.file.photoName;
}

/** The compare groups the photos are in, by name, each with its photos in name order. */
export function compareGroups(photos: ComparePhoto[]): CompareGroup[] {
  const byName = new Map<string, ComparePhoto[]>();
  for (const photo of photos) {
    const name = compareGroupOf(photo.data);
    if (name) byName.set(name, [...(byName.get(name) ?? []), photo]);
  }
  return [...byName]
    .map(([name, members]) => ({ name, photos: members.toSorted(byPhotoName) }))
    .toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function byPhotoName(a: ComparePhoto, b: ComparePhoto): number {
  return comparePhotoName(a).localeCompare(comparePhotoName(b), undefined, { numeric: true });
}

/** The group's winners: the photos picked to post, none until one is. */
export function winnersOf(group: CompareGroup): ComparePhoto[] {
  return group.photos.filter(isWinner);
}

/** The group's photos that aren't winners. */
export function losersOf(group: CompareGroup): ComparePhoto[] {
  return group.photos.filter((photo) => !isWinner(photo));
}

/** The names of photos, joined for reading, such as "A, B and C". */
export function photoNames(photos: ComparePhoto[]): string {
  const names = photos.map(comparePhotoName);
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
