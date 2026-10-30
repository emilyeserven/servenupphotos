import { mutationOptions } from "@tanstack/react-query";
import type { BulkTagPhoto } from "@/api/bulk-tags";
import { locationChanges, post } from "@/api/data";
import type { PhotoPlace, Place } from "@/api/places";
import type { PendingSave } from "@/api/scan-changes";

/** Up to the chosen number of related photos without places: one, then the ones most like it. */
export interface BulkPlacePick {
  branch: string;
  pullRequest: { number: number; url: string } | null;
  /** How many photo files there are. */
  photoFiles: number;
  /** How many photo files have no places. */
  unplaced: number;
  photos: BulkTagPhoto[];
}

/** The places to give one photo, and the city and country to write in where it shows none. */
export interface BulkPlacesPhoto {
  path: string;
  /** The photo's places, the most specific first. */
  places: PhotoPlace[];
  customCity?: string;
  customCountry?: string;
}

/** What Bulk Places saves once reviewed: the new places to make and the places each photo gets. */
export interface BulkPlaces {
  newPlaces: Place[];
  photos: BulkPlacesPhoto[];
}

interface BulkPlacesResult extends PendingSave {
  /** How many places were made. */
  newPlaces: number;
  /** How many photo files got places. */
  photos: number;
}

/** Picks up to `count` related photos without places (1 to 50), leaving out the ones already shown. */
export const pickBulkPlacePhotosMutation = mutationOptions({
  mutationKey: ["data", "bulk-places", "pick"],
  mutationFn: (body: { skip: string[]; count: number }) =>
    post<BulkPlacePick>("/api/data/bulk-places/pick", body),
});

/** Makes the new places and gives each photo its places, as changes waiting for Commit. */
export const applyBulkPlacesMutation = mutationOptions({
  mutationKey: ["data", "bulk-places", "apply"],
  meta: { saves: true, changes: (result) => locationChanges(result as BulkPlacesResult) },
  mutationFn: (bulk: BulkPlaces) => post<BulkPlacesResult>("/api/data/bulk-places", bulk),
});
