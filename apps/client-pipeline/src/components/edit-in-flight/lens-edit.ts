import { type CameraOverride } from "@/api/cameras";
import { type CustomLens } from "@/api/lenses";
import { canonicalJson } from "@/lib/combined";
import { overrideChanges } from "@/lib/camera-overrides";
import { type LensChoice, lensChanged, withLensChoice } from "@/lib/custom-lens";
import type { CombinedPhoto } from "@/lib/group-photos";

/** What the Photo page's Lens and Camera overrides cards change in a saved photo. */
export interface LensEdit extends LensChoice {
  /** Whether Apply overrides was pressed. */
  apply: boolean;
}

/** The camera overrides and custom lenses the fields are worked out with. */
export interface LensSettings {
  overrides: CameraOverride[];
  lenses: CustomLens[];
}

/** Whether the camera overrides are applied: by the button, or by picking another lens. */
export function overridesApplied(saved: CombinedPhoto, edit: LensEdit): boolean {
  return edit.apply || lensChanged(saved, edit);
}

/** The fields of photo whose value differs from saved's. */
function changedFrom(saved: CombinedPhoto, photo: CombinedPhoto): Record<string, unknown> {
  const keys = Object.keys(photo).filter(
    (k) => canonicalJson(photo[k]) !== canonicalJson(saved[k]),
  );
  return Object.fromEntries(keys.map((k) => [k, photo[k]]));
}

/** The fields the overrides change in photo, when they're applied; none when they aren't. */
function appliedChanges(photo: CombinedPhoto, applied: boolean, settings: LensSettings) {
  return applied ? overrideChanges(settings.overrides, settings.lenses, photo) : {};
}

/** The fields edit changes in saved, with their new values, or null when it changes none. */
export function lensEditFields(
  saved: CombinedPhoto,
  edit: LensEdit,
  settings: LensSettings,
): Record<string, unknown> | null {
  const photo = withLensChoice(saved, edit);
  const applied = appliedChanges(photo, overridesApplied(saved, edit), settings);
  const fields = { ...changedFrom(saved, photo), ...applied };
  return Object.keys(fields).length > 0 ? fields : null;
}

/** sanitized with choice and the chosen lens's fields made over it, as a new photo's JSON gets them. */
export function withNewLens<T extends object>(
  sanitized: T,
  choice: LensChoice | null,
  settings: LensSettings,
): T {
  if (!choice) return sanitized;
  const fields = lensEditFields(sanitized as CombinedPhoto, { ...choice, apply: false }, settings);
  return { ...sanitized, ...fields };
}
