import type { SavedPhoto } from "@/components/saved-photo-picker";

/** The most photos a More like this drawer shows, and so the most that can be picked by hand. */
export const MAX_PICKS = 6;

/** The longest note a picked photo can have, in characters. */
export const MAX_PICK_NOTE = 280;

/** The parts of a photo JSON file the related photo pickers read. */
interface SimilarFields {
  similarPhotos?: unknown;
  pickedSimilar?: unknown;
  pickedSimilarNotes?: unknown;
}

/** A photo picked by hand for another's More like this drawer, with the note shown beside it. */
export interface Pick {
  id: number;
  /** Shown to the right of the photo in the drawer; empty for none. */
  note: string;
}

function idList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
}

/** The photo's ID from its JSON, or undefined before it has one. */
export function savedPhotoId(photo: SavedPhoto): number | undefined {
  const { id } = (photo.file.data ?? {}) as { id?: unknown };
  return typeof id === "number" ? id : undefined;
}

/** The IDs Find Related Photos saved in a photo's JSON, best first. */
export function foundIds(data: unknown): number[] {
  return idList((data as SimilarFields | undefined)?.similarPhotos);
}

/** The photos picked by hand in a photo's JSON, with their notes, in the order the drawer shows them. */
export function savedPicks(data: unknown): Pick[] {
  const fields = data as SimilarFields | undefined;
  const notes = (fields?.pickedSimilarNotes ?? {}) as Record<string, unknown>;
  return idList(fields?.pickedSimilar).map((id) => ({ id, note: noteText(notes[String(id)]) }));
}

function noteText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The picks as the backend and the JSON keep them: the IDs in order, and the non-empty notes by ID. */
export function pickFields(picks: readonly Pick[]) {
  const notes = picks
    .map(({ id, note }) => [String(id), note.trim()] as const)
    .filter(([, note]) => note !== "");
  return { ids: picks.map((pick) => pick.id), notes: Object.fromEntries(notes) };
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

/** Whether two lists of picks differ, in order or in their notes. */
export function picksChanged(saved: readonly Pick[], picks: readonly Pick[]): boolean {
  return JSON.stringify(pickFields(saved)) !== JSON.stringify(pickFields(picks));
}

/** data with picks saved as its `pickedSimilar` and `pickedSimilarNotes`, or as it was when they're unchanged. */
export function withPickedSimilar<T extends object>(data: T, picks: readonly Pick[]): T {
  if (!picksChanged(savedPicks(data), picks)) return data;
  const { ids, notes } = pickFields(picks);
  return { ...data, pickedSimilar: ids, pickedSimilarNotes: notes };
}
