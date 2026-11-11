import { entryId } from "@/api/places";
import { byName, settingEntries, settingMutations } from "@/api/data-files";
import type { PhotoBook } from "@/lib/photo-book";

function isPhotoBook(value: unknown): value is PhotoBook {
  return Array.isArray((value as Partial<PhotoBook> | null)?.pages);
}

/** The photo books as the next Commit will have them: PHOTOBOOKS.json with the changes since, by name. */
export const photoBooks = settingEntries("photobooks", isPhotoBook, byName);

/** The ID a new book named name gets, such as `korea-2026`, unless one of taken has it already. */
export function photoBookId(name: string, taken: string[]): string {
  const base = entryId(name).slice(0, 90).replace(/-+$/, "") || "book";
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}

const bookMutations = settingMutations<PhotoBook>("photobooks");

/** Saves a photo book, new or changed, as a change waiting for Commit. */
export const savePhotoBookMutation = bookMutations.save;

/** Removes a photo book, as a change waiting for Commit. */
export const deletePhotoBookMutation = bookMutations.remove;
