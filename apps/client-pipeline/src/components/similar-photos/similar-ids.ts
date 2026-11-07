import type { SavedPhoto } from "@/components/saved-photo-picker";

/** The most photos a More like this drawer shows, and so the most that can be picked by hand. */
export const MAX_PICKS = 6;

/** The parts of a photo JSON file the similar photo pickers read. */
interface SimilarFields {
  similarPhotos?: unknown;
  pickedSimilar?: unknown;
}

function idList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
}

/** The photo's ID from its JSON, or undefined before it has one. */
export function savedPhotoId(photo: SavedPhoto): number | undefined {
  const { id } = (photo.file.data ?? {}) as { id?: unknown };
  return typeof id === "number" ? id : undefined;
}

/** The IDs Find Similar Photos saved in a photo's JSON, best first. */
export function foundIds(data: unknown): number[] {
  return idList((data as SimilarFields | undefined)?.similarPhotos);
}

/** The IDs picked by hand in a photo's JSON, in the order the drawer shows them. */
export function pickedIds(data: unknown): number[] {
  return idList((data as SimilarFields | undefined)?.pickedSimilar);
}

/** The saved photos by their ID, leaving out the ones without one. */
export function photosById(photos: readonly SavedPhoto[]): Map<number, SavedPhoto> {
  const byId = new Map<number, SavedPhoto>();
  for (const photo of photos) {
    const id = savedPhotoId(photo);
    if (id !== undefined) byId.set(id, photo);
  }
  return byId;
}

/** Whether two lists of picks differ, in order. */
export function picksChanged(saved: readonly number[], picked: readonly number[]): boolean {
  return saved.join() !== picked.join();
}

/** data with picked saved as its `pickedSimilar`, or data as it was when the picks are unchanged. */
export function withPickedSimilar<T extends object>(data: T, picked: readonly number[]): T {
  if (!picksChanged(pickedIds(data), picked)) return data;
  return { ...data, pickedSimilar: [...picked] };
}
