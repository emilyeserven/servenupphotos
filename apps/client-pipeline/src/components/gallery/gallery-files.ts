import type {
  InFlightFileRead,
  InFlightImages,
  InFlightRead,
  PublishedFile,
  PublishedResponse,
} from "@/api/photos";
import { photoName } from "@/components/gallery/published-file";
import { isSetAside, isUnselected, titleOf } from "@/lib/drafts";
import { shownImageUrl } from "@/lib/face-json";
import type { CombinedPhoto } from "@/lib/group-photos";
import { isLowerTier } from "@/lib/lower-tier";
import { readEntries } from "@/lib/smart-album-photos";
import { editedData } from "@/lib/undecided";
import type { LocalEdit } from "@/stores/local-edits";
// The photos the Gallery lists: the base branch's with the photo data pull request's and the
// changes waiting for Commit over them, each marked published, draft, Undecided or Lower Tier.
import type { Photo } from "@portfolio/lib/photos";

/**
 * Which **Show** group a photo is in: on the portfolio, a draft without a title, set aside as
 * Undecided, or marked Lower Tier. Each photo is in one, in that order of precedence from the end:
 * an Undecided photo is Undecided whatever else it is, then an untitled one is a draft.
 */
export type PhotoKind = "published" | "draft" | "undecided" | "lowerTier";

/** One photo on the Gallery, as the next Commit will save it. */
export interface GalleryFile extends PublishedFile {
  /** The photo's JSON with its local edits made, as the next Commit will save it; `data` is as read. */
  edited: unknown;
  kind: PhotoKind;
  /** Its title, or else its original file name. */
  name: string;
  /** The photo's image in R2, when it was found there. */
  r2Url?: string;
  /** True when it's only on the base branch, so the Photo page opens it as the base branch's copy. */
  onBase: boolean;
  /** The photo as the portfolio reads it, for the sorts; undefined when it has no date. */
  photo?: Photo;
}

/** A photo file with where it was read from. */
interface Source {
  file: InFlightFileRead;
  /** The pull request's change status when the file came from it, such as `modified`. */
  inFlight?: string;
  onBase: boolean;
}

/**
 * The base branch's photo files with the pull request's (and the changes waiting for Commit) over
 * them: a file the pull request changes or adds is its copy there, and one it removes is left out.
 * Before the pull request is read, the base branch's files keep their own in-flight marks.
 */
function mergedSources(published: PublishedResponse, inFlight?: InFlightRead): Source[] {
  const byPath = new Map<string, Source>(
    published.files.map((file) => [file.path, { file, inFlight: file.inFlight, onBase: true }]),
  );
  for (const file of inFlight?.files ?? []) setInFlight(byPath, file);
  return [...byPath.values()];
}

/** Puts the pull request's copy of a photo file over the base branch's, or takes it out when it's removed. */
function setInFlight(byPath: Map<string, Source>, file: InFlightFileRead) {
  if (file.status === "removed") byPath.delete(file.path);
  else byPath.set(file.path, { file, inFlight: file.status, onBase: false });
}

/**
 * Which Show group the photo is in, by its data with the local edits made. With untitled photos
 * not kept as drafts (see Settings), no photo is a draft or Undecided.
 */
function kindOf(data: unknown, keepDrafts: boolean): PhotoKind {
  const unpublished = keepDrafts ? unpublishedKind(data) : undefined;
  return unpublished ?? (isLowerTier(data) ? "lowerTier" : "published");
}

/** "undecided" when the photo is set aside, "draft" when it has no title, or else undefined. */
function unpublishedKind(data: unknown): PhotoKind | undefined {
  if (isSetAside(data)) return "undecided";
  return titleOf(data) === undefined ? "draft" : undefined;
}

/** The images found in R2 for the base branch's photos and the pull request's, one list. */
export function mergedImages(
  published: PublishedResponse,
  inFlight?: InFlightRead,
): InFlightImages {
  return {
    ...published.images,
    byPath: { ...published.images.byPath, ...inFlight?.images.byPath },
  };
}

/**
 * Every photo for the Gallery, unsorted: the base branch's and the pull request's, with the local
 * edits made. A file that couldn't be read is listed as published, so its problem shows.
 */
export function galleryFiles(
  published: PublishedResponse,
  inFlight: InFlightRead | undefined,
  edits: Record<string, LocalEdit>,
  keepDrafts: boolean,
): GalleryFile[] {
  const images = mergedImages(published, inFlight);
  const files = mergedSources(published, inFlight).map(({ file, inFlight: status, onBase }) => {
    const edited = editedData(file, edits);
    return {
      ...file,
      status: "published" as const,
      inFlight: status,
      edited,
      kind: file.error ? ("published" as const) : kindOf(edited, keepDrafts),
      name: photoName({ ...file, data: edited }),
      r2Url: images.byPath[file.path]?.url,
      onBase,
    };
  });
  return withPhotos(files);
}

/** Whether the photo can be on the portfolio: its JSON was read and it didn't lose in a compare group. */
export function isListable(file: GalleryFile): boolean {
  return isReadable(file) && !isUnselected(file.edited);
}

/** Whether the photo's JSON was read as an object. */
function isReadable(file: Omit<GalleryFile, "photo">): boolean {
  return !file.error && typeof file.edited === "object" && file.edited !== null;
}

/** The files, each with the photo the portfolio reads from its JSON, when it was read and has a date. */
function withPhotos(files: Omit<GalleryFile, "photo">[]): GalleryFile[] {
  const readable = files.filter(isReadable);
  const { photos, ids } = readEntries(readable.map(({ edited }) => edited as CombinedPhoto));
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const byPath = new Map(readable.map((file, index) => [file.path, byId.get(ids[index] ?? 0)]));
  return files.map((file) => ({ ...file, photo: byPath.get(file.path) }));
}

/** The photo's full-size image as the portfolio shows it (with any faces pixelated), or undefined without one in R2. */
export function fullImageUrl(file: Pick<GalleryFile, "edited" | "r2Url">): string | undefined {
  return shownImageUrl(file.edited, file.r2Url);
}
