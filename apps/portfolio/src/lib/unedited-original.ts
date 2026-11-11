import type { PhotoImages } from "./photo-image";

// Imported by private-notes.ts in the Vite config as well as by the app, so this file only imports
// types, by relative path.

/**
 * The part of an unedited original that the edit shows, in the original's pixels, for an edit that
 * was cropped: the Slider and Switch draw only this part, so the two line up.
 */
export interface OriginalCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A photo's unedited original, as its JSON saves it under `original`: the straight-from-camera JPEG
 * uploaded on the pipeline's Photo page, with its resized versions, to compare with the edit.
 */
export interface OriginalEntry {
  /** The original's own file name, such as `DSCF4800.jpg`. */
  file?: string | null;
  /** Its size in pixels, turned upright. */
  width: number | null;
  height: number | null;
  /**
   * Its JPEG (`full`) and R2 key (`key`), which only the pipeline uses, and its resized versions,
   * with its own pixelated areas hidden on them (see `faces`).
   */
  images: PhotoImages & { full?: string | null; key?: string | null };
  /** Whether the portfolio's Raw vs Edited page shows it; missing or false keeps it in the pipeline. */
  showOnPortfolio?: boolean;
  /** The part of it the edit shows, when the edit was cropped; missing or null for all of it. */
  crop?: OriginalCrop | null;
  /**
   * The areas pixelated on its own versions, in its own pixels, as the photo's `faces` are; missing
   * when none are.
   */
  faces?: unknown[];
  /**
   * The photo's own `faces` as they were when the original's areas were last saved, so a change to
   * the photo's pixelation since then holds the original back until it's checked again; missing
   * when they were never saved.
   */
  matchedFaces?: unknown[];
}

/** The fields of a photo's JSON entry that its unedited original is read from. */
interface WithOriginal {
  original?: OriginalEntry | null;
  faces?: unknown;
}

/** The areas as JSON, with none saved as an empty list, to compare two lists of them. */
function facesText(faces: unknown): string {
  return JSON.stringify(Array.isArray(faces) ? faces : []);
}

/**
 * Whether the portfolio may show the photo's unedited original: it's marked to show, and its own
 * pixelated areas were saved against the photo's areas as they are now, so a face hidden on the edit
 * is never shown on the original. When the photo's faces are pixelated again, the original stays off
 * until its areas are saved again in the pipeline. A photo with no pixelated areas needs none saved.
 */
export function isPublishedOriginal(photo: WithOriginal): boolean {
  const { original } = photo;
  if (!original || original.showOnPortfolio !== true) return false;
  return facesText(original.matchedFaces) === facesText(photo.faces);
}

/**
 * The part of a photo's unedited original the portfolio may have: its size, crop and resized
 * versions, without its JPEG's address or key, or undefined when it isn't shown on the portfolio.
 */
export function publicOriginal(photo: WithOriginal): OriginalEntry | undefined {
  if (!isPublishedOriginal(photo) || !photo.original) return undefined;
  const { width, height, images, crop = null } = photo.original;
  const { full: _full, key: _key, ...versions } = images;
  return { width, height, images: versions, crop, showOnPortfolio: true };
}
