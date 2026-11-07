// The photos the All Photos page lists: the base branch's with the photo data pull request's and
// the changes waiting for Commit over them, each marked published, draft or Undecided.
import type { Photo } from "@portfolio/lib/photos";
import type { InFlightFileRead, InFlightRead, PublishedResponse } from "@/api/photos";
import { photoName } from "@/components/gallery/published-file";
import type { CombinedPhoto } from "@/lib/group-photos";
import { isSetAside, isUnselected, titleOf } from "@/lib/drafts";
import { readEntries } from "@/lib/smart-album-photos";
import { editedData } from "@/lib/undecided";
import type { LocalEdit } from "@/stores/local-edits";

/** Whether a photo is on the portfolio, a draft without a title, or set aside as Undecided. */
export type PhotoKind = "published" | "draft" | "undecided";

/** One photo on the All Photos page. */
export interface AllPhotosEntry {
  /** The photo JSON file's path, which the page's `?photo=` names. */
  path: string;
  /** The photo's JSON with its local edits made, as the next Commit will save it. */
  data: unknown;
  kind: PhotoKind;
  /** Its title, or else its original file name. */
  name: string;
  /** The photo's image in R2, when it was found there. */
  imageUrl?: string;
  /** True when it's only on the base branch, so the Photo page opens it as the Gallery does. */
  onBase: boolean;
  /** The photo as the portfolio reads it, for the sorts; undefined when it has no date. */
  photo?: Photo;
}

/** A photo file with where it was read from. */
interface Source {
  file: InFlightFileRead;
  onBase: boolean;
  imageUrl?: string;
}

/** The photo's R2 image, from the pull request's read or else the base branch's. */
function imageOf(path: string, published: PublishedResponse, inFlight?: InFlightRead) {
  return (inFlight?.images.byPath[path] ?? published.images.byPath[path])?.url;
}

/**
 * The base branch's photo files with the pull request's (and the changes waiting for Commit) over
 * them: a file the pull request changes or adds is its copy there, and one it removes is left out.
 */
function mergedSources(published: PublishedResponse, inFlight?: InFlightRead): Source[] {
  const byPath = new Map<string, Source>(
    published.files.map((file) => [
      file.path,
      { file, onBase: true, imageUrl: imageOf(file.path, published) },
    ]),
  );
  for (const file of inFlight?.files ?? []) setInFlight(byPath, file, published, inFlight);
  return [...byPath.values()];
}

/** Puts the pull request's copy of a photo file over the base branch's, or takes it out when it's removed. */
function setInFlight(
  byPath: Map<string, Source>,
  file: InFlightFileRead,
  published: PublishedResponse,
  inFlight?: InFlightRead,
) {
  if (file.status === "removed") byPath.delete(file.path);
  else
    byPath.set(file.path, {
      file,
      onBase: false,
      imageUrl: imageOf(file.path, published, inFlight),
    });
}

/**
 * Whether the photo is published, a draft or Undecided, by its data with the local edits made.
 * With untitled photos not kept as drafts (see Settings), every photo is published.
 */
function kindOf(data: unknown, keepDrafts: boolean): PhotoKind {
  if (!keepDrafts) return "published";
  if (isSetAside(data)) return "undecided";
  return titleOf(data) === undefined ? "draft" : "published";
}

/** Whether the file belongs on the page: its JSON was read and it didn't lose in a compare group. */
function listable(file: InFlightFileRead, data: unknown): boolean {
  return !file.error && typeof data === "object" && data !== null && !isUnselected(data);
}

/**
 * Every photo for the All Photos page, unsorted: the base branch's and the pull request's, with
 * the local edits made, leaving out the ones that couldn't be read and the ones that lost in a
 * compare group, which are never on the portfolio.
 */
export function allPhotosEntries(
  published: PublishedResponse,
  inFlight: InFlightRead | undefined,
  edits: Record<string, LocalEdit>,
  keepDrafts: boolean,
): AllPhotosEntry[] {
  const entries = mergedSources(published, inFlight).flatMap(({ file, onBase, imageUrl }) => {
    const data = editedData(file, edits);
    if (!listable(file, data)) return [];
    const name = photoName({ ...file, data });
    return [{ path: file.path, data, kind: kindOf(data, keepDrafts), name, imageUrl, onBase }];
  });
  return withPhotos(entries);
}

/** The entries, each with the photo the portfolio reads from its JSON, when it has a date. */
function withPhotos(entries: Omit<AllPhotosEntry, "photo">[]): AllPhotosEntry[] {
  const { photos, ids } = readEntries(entries.map(({ data }) => data as CombinedPhoto));
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return entries.map((entry, index) => ({ ...entry, photo: byId.get(ids[index] ?? 0) }));
}
