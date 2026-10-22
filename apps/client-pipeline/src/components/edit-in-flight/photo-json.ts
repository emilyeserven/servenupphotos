import { type UseQueryResult } from "@tanstack/react-query";
import { type PhotoGroups, sameGroups, savedGroups, withGroups } from "@/api/organize";
import {
  type InFlightFileRead,
  type InFlightImages,
  type InFlightRead,
  type PublishedFile,
  type PublishedResponse,
  type UpdateResult,
} from "@/api/photos";
import {
  savedThumbnailCrop,
  squareThumbnailUrl,
  thumbnailCropField,
  thumbnailPreviewUrl,
  thumbnailUrlWithCrop,
} from "@/api/versions";
import {
  type PhotoDetails,
  DETAIL_FIELDS,
  savedDetails,
  withDetails,
} from "@/components/photo-details";
import { type Crop, sameCrop } from "@/lib/crop";
import { jsonFileName } from "@/lib/file-name";

/**
 * A photo JSON file in the pull request, or one already in the portfolio that the pull request
 * doesn't change yet (status `published`), with the image in R2 it can be edited from.
 */
export interface Editable {
  file: InFlightFileRead;
  /** The photo's JSON object as the pull request has it. */
  data: PhotoJson;
  image: { key: string; url: string };
}

/** A photo JSON file's object, with its `images` when it has them. */
export type PhotoJson = Record<string, unknown> & { images?: Record<string, unknown> };

/** Whether the photo is already in the portfolio and not in the pull request yet. */
export function isPublished(file: InFlightFileRead): boolean {
  return file.status === "published";
}

/** Why the file at path can't be edited, or what to edit it from. */
export function findEditable(data: InFlightRead, path: string): Editable | string {
  const file = data.files.find((f) => f.path === path);
  const problem = editProblem(data, file, path);
  if (problem !== undefined || !file) return problem ?? "";
  return { file, data: file.data as PhotoJson, image: data.images.byPath[path]! };
}

/** Why the file at path can't be edited, or undefined when it can. */
function editProblem(
  data: InFlightRead,
  file: InFlightFileRead | undefined,
  path: string,
): string | undefined {
  if (!data.pullRequest) return "No photo data pull request is open.";
  if (!file) return `${path} isn't in the photo data pull request anymore.`;
  return fileProblem(file) ?? imageProblem(data.images, path);
}

/** Why the file's JSON can't be edited, or undefined when it can. */
function fileProblem(file: InFlightFileRead): string | undefined {
  if (file.error) return file.error;
  return isObject(file.data) ? undefined : `${file.path} isn't a JSON object.`;
}

/** Why the file at path has no image in R2 to edit, or undefined when it has one. */
function imageProblem(images: InFlightImages, path: string): string | undefined {
  if (images.byPath[path]) return undefined;
  if (!images.checked) return images.message ?? "Couldn't check R2 for its photo.";
  return "Its photo isn't in R2, so there's nothing to cut a Square Thumbnail from.";
}

/** Why the file at path, already in the portfolio, can't be edited, or what to edit it from. */
function findPublished(data: PublishedResponse, path: string): Editable | string {
  const file = data.files.find((f) => f.path === path);
  if (!file) return `${path} isn't in the photo data pull request or on ${data.branch}.`;
  const problem = publishedProblem(file) ?? imageProblem(data.images, path);
  if (problem !== undefined) return problem;
  return { file, data: file.data as PhotoJson, image: data.images.byPath[path]! };
}

/** Why a file already in the portfolio can't be edited, or undefined when it can. */
function publishedProblem(file: PublishedFile): string | undefined {
  if (file.inFlight === "removed") {
    return `${file.path} is removed in the photo data pull request, so it can't be edited.`;
  }
  return fileProblem(file);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether the pull request has the file at path, so it's edited from there. */
export function inPullRequest(inFlight: InFlightRead, path: string): boolean {
  return inFlight.files.some((f) => f.path === path);
}

/** The file at path on the base branch to edit, why it can't be, or null while it's read. */
export function fromBase(
  published: UseQueryResult<PublishedResponse>,
  path: string,
): Editable | string | null {
  if (published.isError) return published.error.message;
  return published.data ? findPublished(published.data, path) : null;
}

/** The versions cut from the Square Thumbnail's crop, by their key in `images`, with where R2 has each. */
const SQUARE_URLS = { thumbnail: squareThumbnailUrl, thumbnailpreview: thumbnailPreviewUrl };

type SquareName = keyof typeof SQUARE_URLS;

/** The images cut from the Square Thumbnail crop: the thumbnail and its preview. */
export const SQUARE_NAMES = Object.keys(SQUARE_URLS) as SquareName[];

/** The URL of each image cut from the Square Thumbnail crop. */
export type SquareUrls = Record<SquareName, string>;

/** data with its square versions' URLs marked with crop, and crop saved as their `thumbnailcrop`. */
export function withSquares(data: PhotoJson, urls: SquareUrls, crop: Crop): PhotoJson {
  return {
    ...data,
    images: { ...data.images, ...markedUrls(urls, crop), thumbnailcrop: thumbnailCropField(crop) },
  };
}

/** data with crop, the square its square versions were cut from, saved as their `thumbnailcrop` when it isn't yet. */
function withCropField(data: PhotoJson, crop: Crop | null): PhotoJson {
  if (!crop || !hasThumbnail(data) || savedThumbnailCrop(data.images)) return data;
  return { ...data, images: { ...data.images, thumbnailcrop: thumbnailCropField(crop) } };
}

/** urls, each marked with crop. */
export function markedUrls(urls: SquareUrls, crop: Crop): SquareUrls {
  const marked = SQUARE_NAMES.map((name) => [name, thumbnailUrlWithCrop(urls[name], crop)]);
  return Object.fromEntries(marked) as SquareUrls;
}

/** The square versions' URLs saved in data, or else the ones next to the photo's image in R2. */
export function squareUrls(data: PhotoJson, imageUrl: string): SquareUrls {
  const urls = SQUARE_NAMES.map((name) => [
    name,
    savedUrl(data.images?.[name]) ?? SQUARE_URLS[name](imageUrl),
  ]);
  return Object.fromEntries(urls) as SquareUrls;
}

function savedUrl(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** Whether saving would remake the square versions; a photo saved before Square Thumbnails or Thumbnail Previews gets them even without a new crop. */
export function cropChanged(crop: Crop | null, baseline: Crop | null, saved: PhotoJson): boolean {
  if (!crop || !baseline) return false;
  return !sameCrop(crop, baseline) || !hasThumbnail(saved);
}

function hasThumbnail(saved: PhotoJson): boolean {
  return SQUARE_NAMES.every((name) => savedUrl(saved.images?.[name]));
}

/** Whether the title, place name, custom city or country, or comment differs from the ones saved in data. */
function detailsChanged(data: PhotoJson, details: PhotoDetails): boolean {
  const next = withDetails({}, details);
  return DETAIL_FIELDS.some((key) => next[key] !== (data[key] ?? null));
}

/** Whether the details, albums or tags differ from the ones saved in data. */
export function fieldsChanged(
  data: PhotoJson,
  details: PhotoDetails,
  groups: PhotoGroups,
): boolean {
  return detailsChanged(data, details) || !sameGroups(savedGroups(data), groups);
}

/**
 * The file name, without .json, that a new title moves the file to, or undefined when it keeps its
 * name: the title is unchanged, the new name is the same, or the file is already in the portfolio.
 */
export function newFileName(
  file: InFlightFileRead,
  saved: PhotoJson,
  title: string,
): string | undefined {
  if (file.status !== "added" || !titleChanged(saved, title)) return undefined;
  const name = jsonFileName(title, photoFile(saved));
  return `${name}.json` === fileName(file.path) ? undefined : name;
}

/** Whether the title being saved differs from the saved one. */
export function titleChanged(saved: PhotoJson, title: string): boolean {
  return title.trim() !== savedDetails(saved).title.trim();
}

/** The photo's original file name, as saved in its JSON. */
export function photoFile(saved: PhotoJson): string {
  return typeof saved.file === "string" ? saved.file : "";
}

/**
 * What saving would do: the crop to remake the square versions from, if they need it, and the JSON to
 * write, which saves baseline as the square versions' crop when they're kept and it isn't saved yet.
 */
export function saveRequest(
  saved: PhotoJson,
  details: PhotoDetails,
  groups: PhotoGroups,
  crop: Crop | null,
  baseline: Crop | null,
  remakeSquares: boolean,
): SaveRequest {
  const data = withGroups(withDetails(saved, details), groups);
  return remakeSquares ? { crop, data } : { crop: null, data: withCropField(data, baseline) };
}

/** The JSON a save request would write, with its square versions marked with the new crop. */
export function nextJson({ crop, data }: SaveRequest, imageUrl: string): PhotoJson {
  return crop ? withSquares(data, squareUrls(data, imageUrl), crop) : data;
}

/** What one save sends: the new crop when it moved, and the photo's new JSON. */
export interface SaveRequest {
  /** The crop to remake the square versions from, or null to leave them as they are. */
  crop: Crop | null;
  /** The JSON to save, with the new Square Thumbnail marked in it when there's a crop. */
  data: PhotoJson;
  /** A new file name, without .json, to move the file to. */
  name?: string;
}

/** data with the file at `from` moved to the updated file's path. */
export function renamedInFlight(
  data: InFlightRead,
  from: string,
  updated: UpdateResult,
): InFlightRead {
  const { [from]: image, ...byPath } = data.images.byPath;
  return {
    ...data,
    files: data.files.map((f) =>
      f.path === from ? { ...f, path: updated.path, fileUrl: updated.fileUrl } : f,
    ),
    images: { ...data.images, byPath: image ? { ...byPath, [updated.path]: image } : byPath },
  };
}

/** The URLs of the square versions R2 answered with. */
export function madeUrls(made: Partial<Record<string, { url: string }>>): Partial<SquareUrls> {
  const urls = SQUARE_NAMES.flatMap((name) => (made[name] ? [[name, made[name].url]] : []));
  return Object.fromEntries(urls) as Partial<SquareUrls>;
}

/** The last part of a repository path. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
