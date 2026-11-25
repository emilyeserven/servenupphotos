import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ScannedPhotos } from "@/api/data";
import { settingEntries, settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import { entryId } from "@/api/places";
import { post } from "@/api/request";
import { type PendingSave, photoChanges } from "@/api/scan-changes";

/**
 * A photo field a camera or lens override can set: the ones read from EXIF, except the photo's size, and
 * whether its aperture is manual or unknown.
 */
export type OverrideField =
  | "camera"
  | "lens"
  | "aperture"
  | "manualAperture"
  | "exposure"
  | "iso"
  | "focalLength"
  | "gpsPosition"
  | "createDate"
  | "country"
  | "city";

/** One value a photo file has for a field: a string, a number, true or false, or null for none. */
export type OverrideValue = string | number | boolean | null;

/** A field a camera or lens override can set, with how the Camera Overrides page writes it. */
export interface OverrideFieldInfo {
  field: OverrideField;
  /** Its name, such as "Focal length". */
  label: string;
  /** "number" for a field the photo files have as a number, such as 5.6 for f/5.6; "boolean" for yes or no. */
  type: "text" | "number" | "boolean";
}

/** The fields, in the order the page offers them. */
export const OVERRIDE_FIELDS: OverrideFieldInfo[] = [
  { field: "camera", label: "Camera", type: "text" },
  { field: "lens", label: "Lens", type: "text" },
  { field: "focalLength", label: "Focal length (mm)", type: "number" },
  { field: "aperture", label: "Aperture (f-number)", type: "number" },
  { field: "manualAperture", label: "Manual/unknown aperture", type: "boolean" },
  { field: "exposure", label: "Exposure (s)", type: "text" },
  { field: "iso", label: "ISO", type: "number" },
  { field: "gpsPosition", label: "GPS position", type: "text" },
  { field: "createDate", label: "Date taken", type: "text" },
  { field: "country", label: "Country", type: "text" },
  { field: "city", label: "City", type: "text" },
];

/** The field's name, such as "Focal length (mm)". */
export function fieldLabel(field: OverrideField): string {
  return OVERRIDE_FIELDS.find((f) => f.field === field)?.label ?? field;
}

/** A rule's condition: photos whose EXIF has `field` set to `value`, such as the lens "21.0 mm". */
export interface OverrideCondition {
  field: OverrideField;
  value: OverrideValue;
}

/** Fields a rule writes, such as `{ lens: "7Artisans 21mm", aperture: 1.4 }`. */
export type OverrideSet = Partial<Record<OverrideField, OverrideValue>>;

/** One rule of a camera or lens override; a later rule's value for a field wins. */
export interface OverrideRule {
  /** Null for every photo taken with the camera (or lens). */
  when: OverrideCondition | null;
  set: OverrideSet;
}

/**
 * A camera override file: what to write instead of the EXIF values of the photos taken with one
 * camera, such as "Fujifilm X-T5" for the camera "X-T5". Commit combines them into CAMERAS.json.
 */
export interface CameraOverride {
  /** Made from the camera when the override is made, and kept after that. */
  id: string;
  /** The camera as its photos' EXIF names it, such as "X-T5". */
  camera: string;
  rules: OverrideRule[];
}

function isOverride(value: unknown): value is CameraOverride {
  const v = value as Partial<CameraOverride> | null;
  return typeof v?.camera === "string" && Array.isArray(v.rules);
}

/** The camera overrides as the next Commit will have them: CAMERAS.json with the changes since. */
export const cameraOverrides = settingEntries("cameras", isOverride);

/** The ID a new override gets, such as `x-t5`. */
export function overrideId(camera: string): string {
  return entryId(camera).slice(0, 100).replace(/-+$/, "");
}

const overrideMutations = settingMutations<CameraOverride>("cameras");

/** Saves a camera override, new or changed, as a change waiting for Commit. */
export const saveOverrideMutation = overrideMutations.save;

/** Removes a camera override, as a change waiting for Commit. */
export const deleteOverrideMutation = overrideMutations.remove;

/**
 * A lens override file: what to write instead of the EXIF values of the photos taken with one lens,
 * whatever the camera, such as "Fujinon XF 23mm F1.4 R" for the lens "XF23mmF1.4 R". Commit combines
 * them into LENSOVERRIDES.json.
 */
export interface LensOverride {
  /** Made from the lens when the override is made, and kept after that. */
  id: string;
  /** The lens as its photos' EXIF names it, such as "XF23mmF1.4 R". */
  lens: string;
  /** Made before the rules of the photo's camera override, so those win where both set a field. */
  rules: OverrideRule[];
}

function isLensOverride(value: unknown): value is LensOverride {
  const v = value as Partial<LensOverride> | null;
  return typeof v?.lens === "string" && Array.isArray(v.rules);
}

/** The lens overrides as the next Commit will have them: LENSOVERRIDES.json with the changes since. */
export const lensOverrides = settingEntries("lensoverrides", isLensOverride);

const lensOverrideMutations = settingMutations<LensOverride>("lensoverrides");

/** Saves a lens override, new or changed, as a change waiting for Commit. */
export const saveLensOverrideMutation = lensOverrideMutations.save;

/** Removes a lens override, as a change waiting for Commit. */
export const deleteLensOverrideMutation = lensOverrideMutations.remove;

/** The camera and lens overrides, which a photo's fields are worked out with together. */
export interface Overrides {
  cameras: CameraOverride[];
  lenses: LensOverride[];
}

/** The camera and lens overrides as the next Commit will have them. */
export function allOverrides(data: CombinedData | undefined): Overrides {
  return { cameras: cameraOverrides(data), lenses: lensOverrides(data) };
}

/** One field applying the camera and lens overrides again changes in a photo file. */
export interface FieldChange {
  /** One of the override fields, or `exifOriginals`, where the EXIF values they replaced are kept. */
  field: string;
  /** Its value now; null when the file doesn't have it. */
  from: unknown;
  to: unknown;
}

/** What applying the camera and lens overrides again would change in every photo file. */
interface ReapplyPreview extends ScannedPhotos {
  /** How many camera and lens overrides there are. */
  overrides: number;
  files: { path: string; fileUrl: string; camera: string; changes: FieldChange[] }[];
}

interface ReapplyResult extends PendingSave {
  files: number;
  fields: number;
}

/** Reads every photo file and previews applying the camera and lens overrides to it again. */
export const reapplyPreviewQuery = queryOptions({
  queryKey: ["data", "camera-overrides"],
  queryFn: () => post<ReapplyPreview>("/api/data/camera-overrides/preview", {}),
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 0,
});

/** Applies the camera and lens overrides again to every photo file, as changes waiting for Commit. */
export const reapplyMutation = mutationOptions({
  mutationKey: ["data", "camera-overrides", "apply"],
  meta: { saves: true, changes: (result) => photoChanges(result as ReapplyResult) },
  mutationFn: () => post<ReapplyResult>("/api/data/camera-overrides", {}),
});
