import { mutationOptions } from "@tanstack/react-query";
import { post } from "@/api/data";
import { photoChanges, type PendingSave } from "@/api/scan-changes";
import { requestJson } from "@/api/settings";

/** What Find Similar Photos saved: a new list of similar photos on each photo whose list changed. */
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
}

/**
 * Works out every photo's most similar photos on the backend and saves their IDs in each photo's
 * `similarPhotos`, as changes waiting for Commit.
 */
export const findSimilarPhotosMutation = mutationOptions({
  mutationKey: ["data", "similar-photos"],
  meta: { saves: true, changes: (result) => photoChanges(result as SimilarPhotosResult) },
  mutationFn: () => post<SimilarPhotosResult>("/api/data/similar-photos", {}),
});

/** Saves one photo's hand-picked similar photos in its `pickedSimilar`, as a change waiting for Commit. */
export const setPickedSimilarMutation = mutationOptions({
  mutationKey: ["data", "similar-photos", "picked"],
  meta: { saves: true, changes: (result) => photoChanges(result as PendingSave) },
  mutationFn: (body: PickedSimilar) =>
    requestJson<PendingSave>("/api/data/similar-photos/picked", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
});
