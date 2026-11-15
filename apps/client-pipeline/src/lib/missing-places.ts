import type { AutogroupPhoto } from "@/lib/compare-autogroup";
import { isCasual } from "@/lib/drafts";
import { hasOwnGps, hasPlace, isMarkedNoGps } from "@/lib/needs-attention";

/**
 * Why a photo has no place, which says how to give it one: it has a GPS position, so Bulk Places
 * can find its place; an LLM already found none for it in Bulk Places; it has no GPS position; or
 * it's marked as going without one.
 */
export type MissingPlaceReason = "hasGps" | "noPlaceFound" | "noGps" | "markedNoGps";

/** A photo without a place, and why. */
export interface MissingPlace {
  entry: AutogroupPhoto;
  reason: MissingPlaceReason;
}

/** Why the photo with this data, at path, has no place. */
function reasonOf(
  data: Record<string, unknown>,
  path: string,
  noPlaceFound: ReadonlySet<string>,
): MissingPlaceReason {
  if (hasOwnGps(data)) return noPlaceFound.has(path) ? "noPlaceFound" : "hasGps";
  return isMarkedNoGps(data) ? "markedNoGps" : "noGps";
}

/**
 * The photos with no place row that has an ID, in the order given, each with why, leaving out
 * casual photos, which only show with their place on a Trip page. `noPlaceFound` is the paths
 * Bulk Places' LLM found no place for.
 */
export function missingPlaces(
  photos: AutogroupPhoto[],
  noPlaceFound: ReadonlySet<string> = new Set(),
): MissingPlace[] {
  return photos
    .filter(({ photo }) => !isCasual(photo.data) && !hasPlace(photo.data))
    .map((entry) => ({
      entry,
      reason: reasonOf(entry.photo.data, entry.photo.file.path, noPlaceFound),
    }));
}
