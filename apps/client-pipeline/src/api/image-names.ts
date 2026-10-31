import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { FieldChange } from "@/api/cameras";
import { type ScannedPhotos, post } from "@/api/data";
import { type PendingSave, photoChanges } from "@/api/scan-changes";

/** A photo whose image moves in R2 to keys named after its title. */
export interface ImageRename {
  path: string;
  fileUrl: string;
  title: string;
  /** The original's key now, such as `photos/59124cb186a8-dsc0001.jpg`. */
  from: string;
  /** Its key after, such as `photos/59124cb186a8-amsterdam-canal.jpg`. */
  to: string;
  /** The image URLs and key rewritten in the photo's JSON, each under `images`. */
  changes: FieldChange[];
}

/** What naming the photos' images in R2 after their titles would change. */
interface ImageNamesPreview extends ScannedPhotos {
  /** How many photos' images are already named after their titles. */
  named: number;
  /** How many photos have no title (or none with letters or numbers), so they keep their names. */
  untitled: number;
  /** How many photos' images weren't uploaded by the pipeline, so they can't be renamed. */
  elsewhere: number;
  files: ImageRename[];
}

interface ImageNamesResult extends PendingSave {
  files: number;
  fields: number;
}

/** Lists the bucket and every photo file, and the photos whose images would be renamed after their titles. */
export const imageNamesPreviewQuery = queryOptions({
  queryKey: ["data", "image-names"],
  queryFn: () => post<ImageNamesPreview>("/api/data/image-names/preview", {}),
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 0,
});

/** Copies each of those photos' images to its new name in R2, and saves the new links as changes waiting for Commit. */
export const renameImagesMutation = mutationOptions({
  mutationKey: ["data", "image-names", "apply"],
  meta: { saves: true, changes: (result) => photoChanges(result as ImageNamesResult) },
  mutationFn: () => post<ImageNamesResult>("/api/data/image-names", {}),
});
