import type { UploadResponse } from "@/api/upload";
import { type FaceBox, withFacesMark } from "@/lib/face-boxes";
import { FACES, ORIGINAL } from "@/lib/photo-fields";
import {
  type OriginalCrop,
  type OriginalEntry,
  isPublishedOriginal,
} from "@portfolio/lib/unedited-original";

export type { OriginalCrop, OriginalEntry } from "@portfolio/lib/unedited-original";

/** A width and height in pixels. */
export interface Size {
  width: number;
  height: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The photo's unedited original as its JSON saves it, or null when it has none. */
export function originalFromJson(data: Record<string, unknown>): OriginalEntry | null {
  const value = data[ORIGINAL];
  if (!isRecord(value) || !isRecord(value.images)) return null;
  return value as unknown as OriginalEntry;
}

/** data with its unedited original set to original, or left out when that's null. */
export function withOriginal(
  data: Record<string, unknown>,
  original: OriginalEntry | null,
): Record<string, unknown> {
  const { [ORIGINAL]: _old, ...rest } = data;
  return original ? { ...rest, [ORIGINAL]: original } : rest;
}

/** The pixelated areas the photo's own JSON saves, exactly as saved, or none. */
export function savedFaces(data: Record<string, unknown>): unknown[] {
  const faces = data[FACES];
  return Array.isArray(faces) ? faces : [];
}

/** A size's width and height when both are known numbers, or null. */
export function knownSize(value: object): Size | null {
  const { width, height } = value as { width?: unknown; height?: unknown };
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

/**
 * The name the original is uploaded under: the photo's own file name with `-original` after it,
 * such as `DSCF4800-original.jpg`, so its R2 key sits next to the edit's without being taken for
 * another photo's.
 */
export function originalUploadName(file: string): string {
  const stem = file.replace(/\.[^.]*$/, "").trim() || "photo";
  return `${stem}-original`;
}

/**
 * The `original` field for a new upload: its JPEG, key and resized versions, its size, and nothing
 * else, since a crop, pixelated areas or being shown were for the image it replaces.
 */
export function uploadedOriginal(upload: UploadResponse, file: string, size: Size): OriginalEntry {
  const urls = Object.fromEntries(Object.entries(upload.versions).map(([n, v]) => [n, v.url]));
  return { file, ...size, images: { full: upload.url, key: upload.key, ...urls } };
}

/**
 * original after its versions were remade with faces pixelated (none stops pixelating): its URLs
 * marked anew, its areas set to faces, and the photo's own areas kept as matched, so the portfolio
 * may show it.
 */
export function pixelatedOriginal(
  original: OriginalEntry,
  faces: FaceBox[],
  photoFaces: unknown[],
  mark: string,
): OriginalEntry {
  const { faces: _old, matchedFaces: _matched, ...rest } = original;
  const images = withFacesMark(original.images, mark) as OriginalEntry["images"];
  return {
    ...rest,
    images,
    ...(faces.length > 0 ? { faces } : {}),
    matchedFaces: photoFaces,
  };
}

/**
 * Whether the original's areas were saved against the photo's areas as they are now (or the photo
 * has none), which the portfolio needs before it shows the original.
 */
export function facesChecked(data: Record<string, unknown>, original: OriginalEntry): boolean {
  return JSON.stringify(original.matchedFaces ?? []) === JSON.stringify(savedFaces(data));
}

/** Whether the portfolio shows the photo's original as its JSON saves it. */
export function originalShown(data: Record<string, unknown>): boolean {
  return isPublishedOriginal(data as Parameters<typeof isPublishedOriginal>[0]);
}

/**
 * The largest part of the original in the edit's shape, in its middle: all of it when the two are
 * the same shape (to within half a percent).
 */
export function middleCrop(original: Size, edit: Size): OriginalCrop {
  const aspect = edit.width / edit.height;
  const own = original.width / original.height;
  if (Math.abs(own / aspect - 1) < 0.005) return { x: 0, y: 0, ...original };
  const width = own > aspect ? original.height * aspect : original.width;
  const height = width / aspect;
  return rounded({
    x: (original.width - width) / 2,
    y: (original.height - height) / 2,
    width,
    height,
  });
}

/** crop in whole pixels. */
function rounded(crop: OriginalCrop): OriginalCrop {
  return {
    x: Math.round(crop.x),
    y: Math.round(crop.y),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
  };
}

/** The original's saved crop, or else the middle part in the edit's shape. */
export function cropOrMiddle(original: OriginalEntry, edit: Size): OriginalCrop | null {
  const size = knownSize(original);
  if (!size) return null;
  return original.crop ?? middleCrop(size, edit);
}

/** crop moved by dx and dy, kept inside the original. */
export function movedCrop(crop: OriginalCrop, dx: number, dy: number, bounds: Size): OriginalCrop {
  return rounded({
    ...crop,
    x: Math.min(Math.max(0, crop.x + dx), bounds.width - crop.width),
    y: Math.min(Math.max(0, crop.y + dy), bounds.height - crop.height),
  });
}

/** The smallest a crop gets, as a share of the original's shorter side. */
const MIN_CROP = 0.05;

/**
 * crop with its bottom-right corner dragged by dx, keeping its top-left corner and its shape, no
 * smaller than a twentieth of the original and no bigger than fits in it.
 */
export function resizedCrop(crop: OriginalCrop, dx: number, bounds: Size): OriginalCrop {
  const aspect = crop.width / crop.height;
  const most = Math.min(bounds.width - crop.x, (bounds.height - crop.y) * aspect);
  const least = Math.min(bounds.width, bounds.height) * MIN_CROP;
  const width = Math.min(most, Math.max(least, crop.width + dx));
  return rounded({ ...crop, width, height: width / aspect });
}

/**
 * The photo's pixelated areas placed on its original: each moved and scaled from the edit's pixels
 * into the part of the original the edit shows, with the same density, shape and turn.
 */
export function scaledFaces(faces: FaceBox[], edit: Size, crop: OriginalCrop): FaceBox[] {
  const sx = crop.width / edit.width;
  const sy = crop.height / edit.height;
  return faces.map((face) => ({
    ...face,
    x: Math.round(crop.x + face.x * sx),
    y: Math.round(crop.y + face.y * sy),
    width: Math.max(1, Math.round(face.width * sx)),
    height: Math.max(1, Math.round(face.height * sy)),
  }));
}
