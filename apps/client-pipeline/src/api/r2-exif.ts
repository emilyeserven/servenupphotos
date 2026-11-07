import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { type ScannedPhotos, post } from "@/api/data";
import { type PendingSave, photoChanges } from "@/api/scan-changes";
import { requestJson } from "@/api/settings";

/** A photo field whose value can be written into its original's EXIF in R2. */
export type R2ExifField =
  | "createDate"
  | "gpsPosition"
  | "city"
  | "state"
  | "country"
  | "camera"
  | "lens"
  | "aperture"
  | "exposure"
  | "iso"
  | "focalLength";

/** A field whose value in the photo JSON isn't the one its original's EXIF in R2 has. */
export interface R2ExifMismatch {
  field: R2ExifField;
  /** The value the pipeline shows (the custom one when there is one), which is written by default. */
  photo: string;
  /** The value the EXIF in R2 has; null when it has none. */
  r2: string | null;
  /** "custom" for a value written on the Photo page, "override" for a camera override's or custom lens's. */
  source: "custom" | "override" | "";
}

/** One field an edit wrote into the original's EXIF, and whether Lightroom has the change too. */
export interface R2ExifFieldEdit {
  field: R2ExifField;
  /** The EXIF's value before; null when it had none. */
  from: string | null;
  to: string;
  /** Ticked by hand once the same change is made in Lightroom. */
  lightroom: boolean;
}

/** One edit of a photo's original's EXIF in R2, kept under `r2ExifEdits` in its photo file. */
export interface R2ExifEdit {
  /** When the original was overwritten, in ISO 8601. */
  date: string;
  fields: R2ExifFieldEdit[];
}

/** A photo whose original doesn't match its photo file, or with edits to tick off in Lightroom. */
export interface R2ExifPhoto {
  path: string;
  fileUrl: string;
  /** The original's key in R2. */
  key: string;
  title: string;
  /** The Square Thumbnail's URL; empty when it has none. */
  thumbnail: string;
  mismatches: R2ExifMismatch[];
  /** Oldest first. */
  edits: R2ExifEdit[];
  /** Why the original's EXIF couldn't be read, so its mismatches aren't known. */
  error?: string;
}

/** The photos whose originals in R2 don't match their photo files, and the ones edited before. */
export interface R2ExifPreview extends ScannedPhotos {
  /** How many originals were read; photos without `images.key` aren't. */
  checked: number;
  photos: R2ExifPhoto[];
}

/** Where a photo file's edits were saved, and the edits as saved. */
export interface R2ExifResult extends PendingSave {
  edits: R2ExifEdit[];
}

/** A field to write into an original's EXIF, and its new value. */
export interface R2ExifFieldValue {
  field: R2ExifField;
  value: string;
}

/** Reads every photo file and its original's EXIF in R2, listing where they don't match. */
export const r2ExifPreviewQuery = queryOptions({
  queryKey: ["data", "r2-exif"],
  queryFn: () => post<R2ExifPreview>("/api/data/r2-exif/preview", {}),
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: Infinity,
});

/**
 * Overwrites a photo's original in R2 with `fields` written into its EXIF, then notes the edit in its
 * photo file as a change waiting for Commit. `confirm` is the page's explicit confirm step.
 */
export const writeR2ExifMutation = mutationOptions({
  mutationKey: ["data", "r2-exif", "write"],
  meta: { saves: true, changes: (result) => photoChanges(result as R2ExifResult) },
  mutationFn: (body: { path: string; fields: R2ExifFieldValue[] }) =>
    post<R2ExifResult>("/api/data/r2-exif/write", { ...body, confirm: true }),
});

/** Ticks or unticks one field of a photo's EXIF edit as made in Lightroom too. */
export const setR2ExifLightroomMutation = mutationOptions({
  mutationKey: ["data", "r2-exif", "lightroom"],
  meta: { saves: true, changes: (result) => photoChanges(result as R2ExifResult) },
  mutationFn: (body: { path: string; edit: number; field: R2ExifField; done: boolean }) =>
    requestJson<R2ExifResult>("/api/data/r2-exif/lightroom", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
});

/** Each field's name on the page. */
export const R2_EXIF_FIELD_LABELS: Record<R2ExifField, string> = {
  createDate: "Date taken",
  gpsPosition: "GPS position",
  city: "City",
  state: "State",
  country: "Country",
  camera: "Camera",
  lens: "Lens",
  aperture: "Aperture",
  exposure: "Exposure",
  iso: "ISO",
  focalLength: "Focal length",
};

/** How many of the photo's edited fields aren't ticked as made in Lightroom yet. */
export function lightroomToDo(photo: R2ExifPhoto): number {
  return photo.edits.flatMap((e) => e.fields).filter((f) => !f.lightroom).length;
}

/**
 * The preview with `photo` as it is after a save answered `result`: its edits as saved, and the
 * fields just written no longer listed as mismatches.
 */
export function afterSave(
  preview: R2ExifPreview,
  path: string,
  result: R2ExifResult,
  written: R2ExifField[] = [],
): R2ExifPreview {
  return {
    ...preview,
    photos: preview.photos.map((p) =>
      p.path === path
        ? {
            ...p,
            edits: result.edits,
            mismatches: p.mismatches.filter((m) => !written.includes(m.field)),
          }
        : p,
    ),
  };
}
