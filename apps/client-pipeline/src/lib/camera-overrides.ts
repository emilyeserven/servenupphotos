import {
  OVERRIDE_FIELDS,
  type Overrides,
  type OverrideField,
  type OverrideRule,
  type OverrideValue,
} from "@/api/cameras";
import type { CustomLens } from "@/api/lenses";
import { canonicalJson } from "@/lib/combined";
import { chosenLensFields } from "@/lib/custom-lens";
import type { CombinedPhoto } from "@/lib/group-photos";

/** The photo JSON field that keeps the EXIF values of the fields a camera or lens override changed. */
const EXIF_ORIGINALS = "exifOriginals";

/** The fields a camera or lens override changed in photo, with their EXIF values; empty when none. */
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
 * The rules for a photo with the EXIF values exif, in the order they're made: its lens override's,
 * then its camera override's, so a rule for the camera wins over one for the lens.
 */
function rulesFor(overrides: Overrides, exif: Record<string, OverrideValue>): OverrideRule[] {
  const forLens = overrides.lenses.filter((o) => o.lens === exif.lens);
  const forCamera = overrides.cameras.filter((o) => o.camera === exif.camera);
  return [...forLens, ...forCamera].flatMap((o) => o.rules);
}

/**
 * Every override field of photo once the overrides for its lens and camera are made over its EXIF
 * values, then its custom lens's fields, and its exifOriginals: the EXIF values they replaced. A
 * field none sets is its EXIF value, as the backend applies them.
 */
function overriddenFields(
  overrides: Overrides,
  lenses: CustomLens[],
  photo: CombinedPhoto,
): Record<string, unknown> {
  const exif = exifValues(photo);
  const rules = rulesFor(overrides, exif).filter((rule) => applies(rule, exif));
  const sets = [...rules.map((r) => r.set), chosenLensFields(lenses, photo)];
  const out: Record<string, unknown> = Object.assign({ ...exif }, ...sets);
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

/**
 * The fields applying the camera and lens overrides and its custom lens to photo would change, with
 * their new values; empty when none.
 */
export function overrideChanges(
  overrides: Overrides,
  lenses: CustomLens[],
  photo: CombinedPhoto,
): Record<string, unknown> {
  const next = overriddenFields(overrides, lenses, photo);
  return Object.fromEntries(Object.entries(next).filter(([f, to]) => changes(photo, f, to)));
}

/** The field an override is for: the camera, or the lens. */
export type OverrideSubject = "camera" | "lens";

/** The text value of field in the photo's EXIF, or "" when it has none. */
export function exifText(photo: CombinedPhoto, field: OverrideSubject): string {
  const value = exifValue(photo, field);
  return typeof value === "string" ? value : "";
}

/** The camera as the photo's EXIF names it, or "" when it has none. */
export function exifCamera(photo: CombinedPhoto): string {
  return exifText(photo, "camera");
}

/** One camera or lens the photos' EXIF names, with how many photos and its override, if it has one. */
export interface SubjectRow<T> {
  /** The camera or lens as the EXIF names it. */
  name: string;
  photos: number;
  override?: T;
}

/**
 * Every camera (or lens) the photos' EXIF names or an override is for, by name. `nameOf` is the
 * camera or lens an override is for.
 */
export function subjectRows<T>(
  photos: CombinedPhoto[],
  field: OverrideSubject,
  overrides: T[],
  nameOf: (override: T) => string,
): SubjectRow<T>[] {
  const counts = new Map<string, number>(overrides.map((o) => [nameOf(o), 0]));
  for (const name of photos.map((photo) => exifText(photo, field)).filter(Boolean)) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, n]) => ({
      name,
      photos: n,
      override: overrides.find((o) => nameOf(o) === name),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The photos whose EXIF field (camera or lens) is name. */
export function subjectPhotos(
  photos: CombinedPhoto[],
  field: OverrideSubject,
  name: string,
): CombinedPhoto[] {
  return photos.filter((photo) => exifText(photo, field) === name);
}

/** One EXIF value of a field among a camera's (or lens's) photos, with how many photos have it. */
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
