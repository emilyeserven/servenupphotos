import type { SanitizedExif } from "@/api/exif";
import type { UploadResponse } from "@/api/upload";
import { thumbnailCropField } from "@/api/versions";
import { type LensSettings, withNewLens } from "@/components/edit-in-flight/lens-edit";
import { type PhotoJson } from "@/components/edit-in-flight/photo-json";
import { type Size } from "@/lib/crop";
import { savedLensChoice } from "@/lib/custom-lens";

/**
 * The fields read from a photo's EXIF that refreshing them from the new image writes over the saved
 * ones, with the camera overrides as the backend applied them. Width and height always come from the
 * new image.
 */
const EXIF_FIELDS = [
  "camera",
  "lens",
  "aperture",
  "exposure",
  "iso",
  "focalLength",
  "gpsPosition",
  "createDate",
  "country",
  "city",
  "exifOriginals",
] as const;

/** The saved photo's width and height, or null when its JSON doesn't have them. */
export function savedSize(data: PhotoJson): Size | null {
  const { width, height } = data;
  if (typeof width !== "number" || typeof height !== "number") return null;
  return { width, height };
}

/** The new image's width and height as its EXIF read them, or null when they couldn't be. */
export function newSize(sanitized: SanitizedExif | null | undefined): Size | null {
  if (!sanitized?.width || !sanitized.height) return null;
  return { width: sanitized.width, height: sanitized.height };
}

/** Whether a and b are both known and the same size, so the saved Square Thumbnail crop still fits. */
export function sameSize(a: Size | null, b: Size | null): boolean {
  return Boolean(a && b && a.width === b.width && a.height === b.height);
}

/** Whether the new image's EXIF has no camera and no date, as an edited export often doesn't. */
export function exifStripped(sanitized: SanitizedExif): boolean {
  return !sanitized.camera && !sanitized.createDate;
}

/** What replacing the image writes into the photo's JSON besides its new links. */
export interface Replacement {
  /** The new image's EXIF, as the Photo page reads it. */
  sanitized: SanitizedExif;
  /** Whether its EXIF fields replace the saved ones, rather than only its width and height. */
  refreshExif: boolean;
}

/**
 * saved with its images pointing at the upload, its width and height from the new image, and its
 * EXIF fields too when they're refreshed. Everything else, its ID, title, places, albums, tags,
 * spotlight and posts among them, stays as saved.
 */
export function replacedJson(
  saved: PhotoJson,
  upload: UploadResponse,
  replacement: Replacement,
  settings: LensSettings,
): PhotoJson {
  const { width, height } = replacement.sanitized;
  const sized = { ...saved, width, height, images: uploadedImages(saved, upload) };
  return replacement.refreshExif ? withExif(sized, replacement.sanitized, settings) : sized;
}

/**
 * data with the new image's EXIF fields, then the saved custom lens and manual aperture made over
 * them again, as a new photo's JSON gets them.
 */
function withExif(data: PhotoJson, sanitized: SanitizedExif, settings: LensSettings): PhotoJson {
  const fields = Object.fromEntries(EXIF_FIELDS.map((key) => [key, sanitized[key] ?? null]));
  const fresh = { ...data, ...fields, exifOriginals: sanitized.exifOriginals ?? {} };
  const unchosen = { ...fresh, customLens: null, manualAperture: false };
  return withNewLens(unchosen, savedLensChoice(data), settings);
}

/** The photo's images, with the upload's original, versions and Square Thumbnail crop in place of the old ones. */
function uploadedImages(saved: PhotoJson, upload: UploadResponse): Record<string, unknown> {
  const { versions, thumbnailCrop } = upload;
  const urls = Object.fromEntries(Object.entries(versions).map(([name, v]) => [name, v.url]));
  return {
    ...saved.images,
    full: upload.url,
    key: upload.key,
    ...urls,
    thumbnailcrop: thumbnailCrop ? thumbnailCropField(thumbnailCrop) : null,
  };
}
