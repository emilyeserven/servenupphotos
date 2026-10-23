import { overrideId } from "@/api/cameras";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";

/**
 * A custom lens file: a lens the photos' EXIF doesn't name well, such as a manual lens adapted to
 * the camera. A photo given it on the Photo page gets its name, focal length and aperture. Commit
 * combines them into LENSES.json.
 */
export interface CustomLens {
  /** Made from the name when the lens is made, and kept after that. */
  id: string;
  /** What photos given the lens get as their lens, such as "7Artisans 12mm F2.8". */
  name: string;
  description: string;
  /** In millimeters; null leaves the photo's own. */
  focalLength: number | null;
  /** The f-number; null leaves the photo's own, unless manualAperture is set. */
  aperture: number | null;
  /** Whether its aperture is set on the lens by hand, so the photos' EXIF can't say it: they get no aperture. */
  manualAperture: boolean;
}

function isLens(value: unknown): value is CustomLens {
  return typeof (value as Partial<CustomLens> | null)?.name === "string";
}

/** The custom lenses as the next Commit will have them: LENSES.json with the changes since, by name. */
export function customLenses(data: CombinedData | undefined): CustomLens[] {
  const entries = data ? (data.head ?? data.base).lenses.data : undefined;
  return (entries ?? []).filter(isLens).toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The ID a new lens gets, such as `7artisans-12mm-f2-8`. */
export const lensId = overrideId;

const lensMutations = settingMutations<CustomLens>("lenses");

/** Saves a custom lens, new or changed, as a change waiting for Commit. */
export const saveLensMutation = lensMutations.save;

/** Removes a custom lens, as a change waiting for Commit. */
export const deleteLensMutation = lensMutations.remove;
