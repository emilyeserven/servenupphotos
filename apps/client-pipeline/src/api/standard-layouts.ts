import { settingEntries, settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import { EMPTY_STANDARD, type StandardLayouts } from "@/lib/photo-book-standard";

function isStandardLayouts(value: unknown): value is StandardLayouts {
  const file = value as Partial<StandardLayouts> | null;
  return file?.id === "standard" && Array.isArray(file.layouts);
}

const standardEntries = settingEntries("booklayouts", isStandardLayouts);

/** The photo books' standard layouts as the next Commit will have them, or none yet. */
export function standardLayoutsFile(data: CombinedData | undefined): StandardLayouts {
  return standardEntries(data)[0] ?? EMPTY_STANDARD;
}

/** Saves the standard layouts and the built-in layouts hidden in every book, as a change waiting for Commit. */
export const saveStandardLayoutsMutation = settingMutations<StandardLayouts>("booklayouts").save;
