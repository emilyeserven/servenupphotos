import { byName, settingEntries, settingMutations, uniqueEntryId } from "@/api/data-files";
import type { PhotoSet } from "@portfolio/lib/photo-sets";

function isPhotoSet(value: unknown): value is PhotoSet {
  const set = value as Partial<PhotoSet> | null;
  return typeof set?.id === "string" && typeof set.name === "string" && Array.isArray(set.photos);
}

/** The Photo Sets as the next Commit will have them: SETS.json with the changes since, by name. */
export const photoSetFiles = settingEntries("sets", isPhotoSet, byName);

/** The ID a new set named name gets, such as `night-market`, unless one of taken has it already. */
export function photoSetId(name: string, taken: string[]): string {
  return uniqueEntryId(name, taken, "set");
}

const setMutations = settingMutations<PhotoSet>("sets");

/** Saves a Photo Set, new or changed, as a change waiting for Commit. */
export const savePhotoSetMutation = setMutations.save;

/** Removes a Photo Set, as a change waiting for Commit; its photos stay as they are. */
export const deletePhotoSetMutation = setMutations.remove;
