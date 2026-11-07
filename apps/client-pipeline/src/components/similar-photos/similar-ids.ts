import type { SavedPhoto } from "@/components/saved-photo-picker";

/** The parts of a photo JSON file the Similar Photos page reads. */
interface SimilarFields {
  id?: unknown;
  similarPhotos?: unknown;
  pickedSimilar?: unknown;
}

function fieldsOf(photo: SavedPhoto): SimilarFields {
  return (photo.file.data ?? {}) as SimilarFields;
}

function idList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
}

/** The photo's ID from its JSON, or undefined before it has one. */
export function photoId(photo: SavedPhoto): number | undefined {
  const { id } = fieldsOf(photo);
  return typeof id === "number" ? id : undefined;
}

/** The IDs Find Similar Photos saved on the photo, best first. */
export function foundIds(photo: SavedPhoto): number[] {
  return idList(fieldsOf(photo).similarPhotos);
}

/** The IDs picked by hand for the photo, in the order the drawer shows them. */
export function pickedIds(photo: SavedPhoto): number[] {
  return idList(fieldsOf(photo).pickedSimilar);
}

/** The saved photos by their ID, leaving out the ones without one. */
export function photosById(photos: readonly SavedPhoto[]): Map<number, SavedPhoto> {
  const byId = new Map<number, SavedPhoto>();
  for (const photo of photos) {
    const id = photoId(photo);
    if (id !== undefined) byId.set(id, photo);
  }
  return byId;
}

/** list with item moved from one place to another. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [item] = out.splice(from, 1);
  if (item !== undefined) out.splice(to, 0, item);
  return out;
}
