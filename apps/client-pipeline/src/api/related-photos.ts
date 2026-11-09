import { mutationOptions } from "@tanstack/react-query";
import { photoChanges, type PendingSave } from "@/api/scan-changes";
import { post, requestJson } from "@/api/request";

/** What Find Related Photos saved: a new list of related photos on each photo whose list changed. */
interface SimilarPhotosResult extends PendingSave {
  /** How many photo files were compared. */
  photoFiles: number;
  /** How many photo files got a new list; the others already had it. */
  photos: number;
}

/** The photos picked by hand to show first in one photo's More like this drawer, by ID, in order. */
interface PickedSimilar {
  path: string;
  ids: number[];
  /** The note shown beside each picked photo, by its ID; ones without a note are left out. */
  notes: Record<string, string>;
}

/**
 * Works out every photo's most related photos on the backend and saves their IDs in each photo's
 * `similarPhotos`, as changes waiting for Commit.
 */
export const findSimilarPhotosMutation = mutationOptions({
  mutationKey: ["data", "related-photos"],
  meta: { saves: true, changes: (result) => photoChanges(result as SimilarPhotosResult) },
  mutationFn: () => post<SimilarPhotosResult>("/api/data/related-photos", {}),
});

/** Saves one photo's hand-picked related photos in its `pickedSimilar`, with their notes in `pickedSimilarNotes`, as a change waiting for Commit. */
export const setPickedSimilarMutation = mutationOptions({
  mutationKey: ["data", "related-photos", "picked"],
  meta: { saves: true, changes: (result) => photoChanges(result as PendingSave) },
  mutationFn: (body: PickedSimilar) =>
    requestJson<PendingSave>("/api/data/related-photos/picked", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
});
