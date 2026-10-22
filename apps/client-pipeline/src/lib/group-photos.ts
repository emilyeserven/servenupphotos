import type { GroupKind } from "@/api/organize";
import type { CombinedData } from "@/api/photos";

/** An ALLPHOTOS.json entry, as far as the album and tag pages read it. */
export type CombinedPhoto = Record<string, unknown> & {
  images?: Record<string, unknown>;
};

/** The photos ALLPHOTOS.json lists, where it was read, and its page on GitHub. */
interface CurrentPhotos {
  photos: CombinedPhoto[];
  where: string;
  fileUrl?: string;
}

/**
 * ALLPHOTOS.json at the photo data pull request's head when one is open, so photos in flight are
 * included, or else on the base branch; undefined when it couldn't be read.
 */
export function currentPhotos(data: CombinedData): CurrentPhotos | undefined {
  return headPhotos(data) ?? basePhotos(data);
}

function headPhotos({ head }: CombinedData): CurrentPhotos | undefined {
  if (!head?.photos.data) return undefined;
  return {
    photos: head.photos.data.filter(isPhoto),
    where: `the photo data pull request #${head.pullRequest.number}`,
    fileUrl: head.photos.fileUrl,
  };
}

function basePhotos({ base }: CombinedData): CurrentPhotos | undefined {
  if (!base.photos.data) return undefined;
  return {
    photos: base.photos.data.filter(isPhoto),
    where: base.branch,
    fileUrl: base.photos.fileUrl,
  };
}

function isPhoto(entry: unknown): entry is CombinedPhoto {
  return typeof entry === "object" && entry !== null && !Array.isArray(entry);
}

/** The album or tag IDs the photo lists under kind, each once. */
function photoIds(photo: CombinedPhoto, kind: GroupKind): string[] {
  const list = photo[kind];
  return Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === "string"))] : [];
}

/** Whether the photo lists any of ids under kind. */
export function photoIn(photo: CombinedPhoto, kind: GroupKind, ids: ReadonlySet<string>): boolean {
  return photoIds(photo, kind).some((id) => ids.has(id));
}

/** How many photos list each album or tag under kind, by ID. */
export function photoCounts(photos: CombinedPhoto[], kind: GroupKind): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of photos.flatMap((photo) => photoIds(photo, kind))) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** A string field of the photo, trimmed, or undefined when it's empty or not a string. */
export function photoText(photo: CombinedPhoto, field: string): string | undefined {
  const value = photo[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** A URL from the photo's images, or undefined when it has none. */
export function photoImage(photo: CombinedPhoto, name: string): string | undefined {
  const value = photo.images?.[name];
  return typeof value === "string" && value ? value : undefined;
}
