import type { CustomLens } from "@/api/lenses";
import type { CombinedPhoto } from "@/lib/group-photos";

/** The photo JSON field naming the custom lens chosen for the photo on the Photo page, by its ID. */
const CUSTOM_LENS = "customLens";

/** The ID of the custom lens chosen for photo, or null when it has none. */
export function chosenLens(photo: CombinedPhoto): string | null {
  const id = photo[CUSTOM_LENS];
  return typeof id === "string" && id ? id : null;
}

/** The aperture fields lens writes: none, no aperture when it's manual, or its f-number. */
function apertureFields(lens: CustomLens): Record<string, unknown> {
  if (lens.manualAperture) return { aperture: null, manualAperture: true };
  return lens.aperture === null ? {} : { aperture: lens.aperture, manualAperture: false };
}

/** The fields lens writes over a photo: its name as the lens, and its focal length and aperture when it has them. */
export function lensFields(lens: CustomLens): Record<string, unknown> {
  const focal = lens.focalLength === null ? {} : { focalLength: lens.focalLength };
  return { lens: lens.name, ...focal, ...apertureFields(lens) };
}

/** The fields the custom lens chosen for photo writes, as the backend makes them; none without one. */
export function chosenLensFields(
  lenses: CustomLens[],
  photo: CombinedPhoto,
): Record<string, unknown> {
  const lens = lenses.find((l) => l.id === chosenLens(photo));
  return lens ? lensFields(lens) : {};
}

/** The lens chosen for a photo on the Photo page, and whether its aperture is manual or unknown. */
export interface LensChoice {
  /** The chosen custom lens's ID, or null to go by the EXIF and the camera overrides. */
  customLens: string | null;
  /** Whether the photo has no aperture because it was set on the lens by hand or isn't known. */
  manualAperture: boolean;
}

/** The lens choice photo was saved with. */
export function savedLensChoice(photo: CombinedPhoto): LensChoice {
  return { customLens: chosenLens(photo), manualAperture: photo.manualAperture === true };
}

/** The fields setting manual to what photo has writes: none when it's the same, else no aperture when it's set. */
function manualFields(photo: CombinedPhoto, manual: boolean): Record<string, unknown> {
  if (manual === (photo.manualAperture === true)) return {};
  return manual ? { manualAperture: true, aperture: null } : { manualAperture: false };
}

/** photo with choice written into it, before the camera overrides and the lens are applied. */
export function withLensChoice(photo: CombinedPhoto, choice: LensChoice): CombinedPhoto {
  const lens = choice.customLens === chosenLens(photo) ? {} : { [CUSTOM_LENS]: choice.customLens };
  return { ...photo, ...lens, ...manualFields(photo, choice.manualAperture) };
}

/** Whether choice picks another custom lens than photo has, which applies the camera overrides with it. */
export function lensChanged(photo: CombinedPhoto, choice: LensChoice): boolean {
  return choice.customLens !== chosenLens(photo);
}

/** Whether choice names a custom lens or a manual aperture, rather than going by the EXIF. */
export function hasLensChoice(choice: LensChoice): boolean {
  return choice.customLens !== null || choice.manualAperture;
}
