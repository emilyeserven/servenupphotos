import {
  type CameraOverride,
  OVERRIDE_FIELDS,
  type OverrideField,
  type OverrideRule,
  type OverrideValue,
} from "@/api/cameras";
import { canonicalJson } from "@/lib/combined";
import type { CombinedPhoto } from "@/lib/group-photos";

/** The photo JSON field that keeps the EXIF values of the fields a camera override changed. */
const EXIF_ORIGINALS = "exifOriginals";

/** The fields a camera override changed in photo, with their EXIF values; empty when none. */
function originals(photo: CombinedPhoto): Record<string, unknown> {
  const kept = photo[EXIF_ORIGINALS];
  return typeof kept === "object" && kept !== null ? (kept as Record<string, unknown>) : {};
}

/** The photo's EXIF value of field: the one its exifOriginals kept, or else its own. */
export function exifValue(photo: CombinedPhoto, field: OverrideField): OverrideValue {
  const kept = originals(photo);
  const value = field in kept ? kept[field] : photo[field];
  return (value ?? null) as OverrideValue;
}

/** The camera as the photo's EXIF names it, or "" when it has none. */
export function exifCamera(photo: CombinedPhoto): string {
  const camera = exifValue(photo, "camera");
  return typeof camera === "string" ? camera : "";
}

/** Whether a and b are the same JSON value. */
function same(a: unknown, b: unknown): boolean {
  return canonicalJson(a ?? null) === canonicalJson(b ?? null);
}

/** Whether rule applies to a photo with the EXIF values exif. */
function applies(rule: OverrideRule, exif: Record<string, OverrideValue>): boolean {
  return rule.when === null || same(exif[rule.when.field], rule.when.value);
}

/** Each override field's EXIF value in photo. */
function exifValues(photo: CombinedPhoto): Record<string, OverrideValue> {
  return Object.fromEntries(OVERRIDE_FIELDS.map(({ field }) => [field, exifValue(photo, field)]));
}

/**
 * Every override field of photo once the override for its camera is made over its EXIF values, and
 * its exifOriginals: the EXIF values the override replaced. A field no rule sets is its EXIF value,
 * as the backend applies them.
 */
function overriddenFields(
  overrides: CameraOverride[],
  photo: CombinedPhoto,
): Record<string, unknown> {
  const exif = exifValues(photo);
  const override = overrides.find((o) => o.camera === exif.camera);
  const rules = (override?.rules ?? []).filter((rule) => applies(rule, exif));
  const out: Record<string, unknown> = Object.assign({ ...exif }, ...rules.map((r) => r.set));
  const kept = OVERRIDE_FIELDS.filter(({ field }) => !same(out[field], exif[field]));
  out[EXIF_ORIGINALS] = Object.fromEntries(kept.map(({ field }) => [field, exif[field]]));
  return out;
}

/** Whether value is null or an empty object, which a file without the field needn't get. */
function isEmpty(value: unknown): boolean {
  return value === null || canonicalJson(value) === "{}";
}

/** Whether applying the overrides would change field, from its value in photo to `to`. */
function changes(photo: CombinedPhoto, field: string, to: unknown): boolean {
  if (!(field in photo)) return !isEmpty(to);
  return !same(photo[field], to);
}

/** The fields applying the overrides to photo would change, with their new values; empty when none. */
export function overrideChanges(
  overrides: CameraOverride[],
  photo: CombinedPhoto,
): Record<string, unknown> {
  const next = overriddenFields(overrides, photo);
  return Object.fromEntries(Object.entries(next).filter(([f, to]) => changes(photo, f, to)));
}

/** One camera the photos' EXIF names, with how many photos and its override, if it has one. */
export interface CameraRow {
  camera: string;
  photos: number;
  override?: CameraOverride;
}

/** Every camera the photos' EXIF names or an override is for, by name. */
export function cameraRows(photos: CombinedPhoto[], overrides: CameraOverride[]): CameraRow[] {
  const counts = new Map<string, number>(overrides.map((o) => [o.camera, 0]));
  for (const camera of photos.map(exifCamera).filter(Boolean)) {
    counts.set(camera, (counts.get(camera) ?? 0) + 1);
  }
  return [...counts]
    .map(([camera, n]) => ({
      camera,
      photos: n,
      override: overrides.find((o) => o.camera === camera),
    }))
    .toSorted((a, b) => a.camera.localeCompare(b.camera));
}

/** The photos whose EXIF names camera. */
export function cameraPhotos(photos: CombinedPhoto[], camera: string): CombinedPhoto[] {
  return photos.filter((photo) => exifCamera(photo) === camera);
}

/** One EXIF value of a field among a camera's photos, with how many photos have it. */
export interface ValueCount {
  value: OverrideValue;
  photos: number;
}

/** The EXIF values of field among photos, most photos first. */
export function exifValueCounts(photos: CombinedPhoto[], field: OverrideField): ValueCount[] {
  const counts = new Map<string, ValueCount>();
  for (const value of photos.map((photo) => exifValue(photo, field))) {
    const key = canonicalJson(value);
    const count = counts.get(key) ?? { value, photos: 0 };
    counts.set(key, { ...count, photos: count.photos + 1 });
  }
  return [...counts.values()].toSorted((a, b) => b.photos - a.photos);
}
