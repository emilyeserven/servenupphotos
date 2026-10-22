import {
  MutationObserver,
  type MutationObserverOptions,
  type QueryClient,
} from "@tanstack/react-query";
import { type ExifResponse, exifMutation, type SanitizedExif } from "@/api/exif";
import { NO_GROUPS, type PhotoGroups } from "@/api/organize";
import {
  type AllPhotosCheck,
  type AllPhotosMatch,
  type BucketImage,
  type PhotoIdentity,
  type PublishResult,
  publishPhotoMutation,
  pullRequestCheckQuery,
} from "@/api/photos";
import { UploadError, type UploadResponse, uploadMutation } from "@/api/upload";
import { allPhotosCheck, type CombinedView } from "@/lib/combined";
import type { Crop } from "@/lib/crop";
import { jsonFileName } from "@/lib/file-name";
import { withChanges } from "@/lib/optimistic";
import { withImages } from "@/lib/photo-images";
import { useCombinedDataStore } from "@/stores/combined-data";

/**
 * Where a photo is in Bulk Upload: waiting its turn, one of the four steps it goes through, or
 * how it ended. `skipped` is a photo already saved, which is left alone.
 */
export type BulkStep =
  | "waiting"
  | "analyzing"
  | "checking"
  | "uploading"
  | "saving"
  | "added"
  | "skipped"
  | "failed";

/** One photo chosen on Bulk Upload, with what each step found so far. */
export interface BulkPhoto {
  id: string;
  file: File;
  step: BulkStep;
  /** Why it failed or was skipped. */
  error?: string;
  /** Whether trying again could help; false for a photo that isn't a JPEG. */
  retryable?: boolean;
  /** Different photos in R2 under the same name, when that stopped its upload. */
  sameName?: BucketImage[];
  /** Upload even though a different photo in R2 has its name, as the Photo page's "keep the name". */
  keepSameName?: boolean;
  /** Places the already-saved check couldn't read, so it may be saved twice. */
  warning?: string;
  /** Its EXIF and colors, once analyzed; with its title and other details for one from the Photo page. */
  exif?: ExifResponse;
  /** The square its Square Thumbnail is cut from; the middle square when left out. */
  crop?: Crop;
  /** The albums and tags to save it in; none when left out. */
  groups?: PhotoGroups;
  /** Where it ended up in R2, once uploaded. */
  upload?: UploadResponse;
  /** The saved entries that match it, when it was skipped as already saved. */
  matches?: AllPhotosMatch[];
  /** Where its JSON was saved in the photo data pull request, once added to the batch. */
  saved?: PublishResult;
}

/** What a step found, made over the photo; a `step` of `skipped` ends its run there. */
type StepResult = Partial<BulkPhoto>;

/** Runs a mutation as `useMutation` would, so the app notes what it pushed to the pull request. */
function runMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: MutationObserverOptions<TData, Error, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return new MutationObserver(queryClient, options).mutate(variables);
}

const JPEG_TYPES = ["image/jpeg", "image/pjpeg"];

/** Whether file is a JPEG, the only kind the pipeline uploads. */
export function isJpeg(file: File): boolean {
  return JPEG_TYPES.includes(file.type);
}

function sanitizedOf(photo: BulkPhoto): SanitizedExif {
  const sanitized = photo.exif?.sanitized;
  if (!sanitized) {
    throw new Error("Its EXIF couldn't be read because exiftool isn't running on the backend.");
  }
  return sanitized;
}

/** Reads the photo's EXIF and colors, as the Photo page does when a photo is chosen. */
async function analyze(photo: BulkPhoto, queryClient: QueryClient): Promise<StepResult> {
  const exif = await runMutation(queryClient, exifMutation, photo.file);
  sanitizedOf({ ...photo, exif });
  return { exif };
}

/** The photo's original file name, as the backend read it. */
function fileOf(photo: BulkPhoto): string {
  return photo.exif?.file ?? photo.file.name;
}

function identityOf(photo: BulkPhoto): PhotoIdentity {
  const { gpsPosition, createDate } = sanitizedOf(photo);
  return { file: fileOf(photo), gpsPosition, createDate };
}

/** ALLPHOTOS.json from the combined data store, with the photos pushed since made over it. */
async function combinedView(): Promise<CombinedView> {
  await useCombinedDataStore.getState().load();
  const { data, error, changes } = useCombinedDataStore.getState();
  return { data: data && withChanges(data, changes), error };
}

/** The backend's look through the photo data pull request's files, or why it couldn't. */
function pullRequestCheck(queryClient: QueryClient, identity: PhotoIdentity) {
  return queryClient.fetchQuery(pullRequestCheckQuery(identity)).then(
    (check) => ({ check }),
    (error: Error) => ({ error }),
  );
}

/** The places the check couldn't read, as a warning; undefined when it read them all. */
function sourceWarning(check: AllPhotosCheck): string | undefined {
  const problems = check.sources.filter((source) => source.error);
  if (problems.length === 0) return undefined;
  const list = problems.map((source) => `${source.label} (${source.error})`).join(" or ");
  return `Couldn't fully check ${list}, so make sure it isn't saved twice.`;
}

/** Looks for the photo in the saved photo data, as the Photo page does, and skips it when it's there. */
async function checkSaved(photo: BulkPhoto, queryClient: QueryClient): Promise<StepResult> {
  const identity = identityOf(photo);
  const view = await combinedView();
  const result = allPhotosCheck(identity, view, await pullRequestCheck(queryClient, identity));
  if (result.matches.length === 0) return { warning: sourceWarning(result) };
  const where = result.matches[0]?.source ?? result.path;
  return { step: "skipped", matches: result.matches, error: `Already saved in ${where}.` };
}

/** Uploads the photo, its resized versions and its Square Thumbnail from the middle square. */
async function upload(photo: BulkPhoto, queryClient: QueryClient): Promise<StepResult> {
  const request = { photo: photo.file, keepSameName: photo.keepSameName, crop: photo.crop };
  return { upload: await runMutation(queryClient, uploadMutation, request) };
}

/** The photo's sanitized EXIF with its R2 URLs, once uploaded. */
function withUpload(photo: BulkPhoto): SanitizedExif {
  const exif = sanitizedOf(photo);
  return withImages(exif, photo.upload) ?? exif;
}

function groupsOf(photo: BulkPhoto): PhotoGroups {
  return photo.groups ?? NO_GROUPS;
}

/** Adds the photo's JSON to the photo data pull request, named after its title or else its file name. */
async function save(photo: BulkPhoto, queryClient: QueryClient): Promise<StepResult> {
  const file = fileOf(photo);
  // The places go next to the albums and tags, as Add to Batch sends them.
  const { places = [], ...sanitized } = withUpload(photo);
  const name = jsonFileName(sanitized.title, file);
  const variables = { name, file, sanitized, ...groupsOf(photo), places };
  return { step: "added", saved: await runMutation(queryClient, publishPhotoMutation, variables) };
}

interface Step {
  step: BulkStep;
  /** Whether the photo still needs this step, so trying again picks up where it stopped. */
  needed: (photo: BulkPhoto) => boolean;
  run: (photo: BulkPhoto, queryClient: QueryClient) => Promise<StepResult>;
}

/** The steps every photo goes through, in order. */
export const BULK_STEPS: Step[] = [
  { step: "analyzing", needed: (photo) => !photo.exif, run: analyze },
  { step: "checking", needed: (photo) => !photo.upload, run: checkSaved },
  { step: "uploading", needed: (photo) => !photo.upload, run: upload },
  { step: "saving", needed: () => true, run: save },
];

/** What a step's failure leaves on the photo: the reason, and the photos under its name if that was it. */
export function failure(error: unknown): StepResult {
  const message = error instanceof Error ? error.message : String(error);
  const sameName = error instanceof UploadError ? error.sameName : [];
  return { step: "failed", error: message, retryable: true, sameName };
}
