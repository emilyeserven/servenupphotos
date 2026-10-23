import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ScannedPhotos } from "@/api/data";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import { entryId } from "@/api/places";
import { type PendingSave, photoChanges } from "@/api/scan-changes";
import { requestJson } from "@/api/settings";

/**
 * A photo field a camera override can set: the ones read from EXIF, except the photo's size, and
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

/** A field a camera override can set, with how the Camera Overrides page writes it. */
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

/** One rule of a camera override; a later rule's value for a field wins. */
export interface OverrideRule {
  /** Null for every photo taken with the camera. */
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

/** CAMERAS.json as the next Commit will have it, with the changes since. */
function overridesFile(data: CombinedData) {
  return (data.head ?? data.base).cameras;
}

/** The camera overrides as the next Commit will have them: CAMERAS.json with the changes since. */
export function cameraOverrides(data: CombinedData | undefined): CameraOverride[] {
  const entries = data ? overridesFile(data).data : undefined;
  return (entries ?? []).filter(isOverride);
}

/** The ID a new override gets, such as `x-t5`. */
export function overrideId(camera: string): string {
  return entryId(camera).slice(0, 100).replace(/-+$/, "");
}

const overrideMutations = settingMutations<CameraOverride>("cameras");

/** Saves a camera override, new or changed, as a change waiting for Commit. */
export const saveOverrideMutation = overrideMutations.save;

/** Removes a camera override, as a change waiting for Commit. */
export const deleteOverrideMutation = overrideMutations.remove;

/** One field applying the camera overrides again changes in a photo file. */
export interface FieldChange {
  /** One of the override fields, or `exifOriginals`, where the EXIF values they replaced are kept. */
  field: string;
  /** Its value now; null when the file doesn't have it. */
  from: unknown;
  to: unknown;
}

/** What applying the camera overrides again would change in every photo file. */
export interface ReapplyPreview extends ScannedPhotos {
  /** How many camera overrides there are. */
  overrides: number;
  files: { path: string; fileUrl: string; camera: string; changes: FieldChange[] }[];
}

export interface ReapplyResult extends PendingSave {
  files: number;
  fields: number;
}

function post<T>(url: string) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

/** Reads every photo file and previews applying the camera overrides to it again. */
export const reapplyPreviewQuery = queryOptions({
  queryKey: ["data", "camera-overrides"],
  queryFn: () => post<ReapplyPreview>("/api/data/camera-overrides/preview"),
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 0,
});

/** Applies the camera overrides again to every photo file, as changes waiting for Commit. */
export const reapplyMutation = mutationOptions({
  mutationKey: ["data", "camera-overrides", "apply"],
  meta: { saves: true, changes: (result) => photoChanges(result as ReapplyResult) },
  mutationFn: () => post<ReapplyResult>("/api/data/camera-overrides"),
});
