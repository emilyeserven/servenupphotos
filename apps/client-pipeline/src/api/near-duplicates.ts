import { mutationOptions } from "@tanstack/react-query";
import { post } from "@/api/data";
import { type PendingSave, photoChanges } from "@/api/scan-changes";

/** A compare group photos that look nearly the same were put in. */
export interface NearDuplicates {
  /** The compare group's name. */
  group: string;
  /** The photo files in it: for a save, the ones the saved photo looks like. */
  paths: string[];
}

/** What Find near duplicates saved, waiting for Commit. */
export interface NearDuplicatesResult extends PendingSave {
  /** How many photo files were looked through. */
  photos: number;
  /** How many got a perceptual hash, and how many couldn't, such as one without a Small version. */
  hashed: number;
  hashFailed: number;
  /** The compare groups near duplicates were put in, with the photos each has now. */
  groups: NearDuplicates[];
}

/**
 * Gives every photo without a perceptual hash one, from its Small version, and puts each set of
 * photos that look nearly the same in a compare group, as changes waiting for Commit.
 */
export const findNearDuplicatesMutation = mutationOptions({
  mutationKey: ["data", "near-duplicates"],
  meta: { saves: true, changes: (result) => photoChanges(result as NearDuplicatesResult) },
  mutationFn: () => post<NearDuplicatesResult>("/api/data/near-duplicates", {}),
});
