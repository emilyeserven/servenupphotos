import { useMutation } from "@tanstack/react-query";
import { type DeleteBucketImagesResult, deleteBucketImagesMutation } from "@/api/photos";
import { type ComparePhoto, comparePhotoName } from "@/lib/compare-groups";
import { keysToDelete } from "@/lib/unselected";

/** A photo whose images couldn't all be deleted from R2, and why. */
export interface DiscardFailure {
  path: string;
  name: string;
  message: string;
}

/** Why a delete left some of the photo's images in R2, or undefined when it left none. */
function failureMessage(result: DeleteBucketImagesResult): string | undefined {
  const [first] = result.failed;
  if (!first) return undefined;
  return `${result.failed.length} of its files couldn't be deleted: ${first.message}`;
}

/** The error's message, for a request that failed outright, such as offline. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Deletes unselected photos' images from R2, one photo at a time, through Explore Bucket's delete
 * (`POST /api/photos/bucket/delete`): with `small`, the original and the versions bigger than Small,
 * and with `deleted`, every version and thumbnail too. Only R2 changes; the photo JSON says what's
 * left. Resolves with the photos that couldn't be done.
 */
export function useDiscardImages() {
  const mutation = useMutation(deleteBucketImagesMutation);
  const discardOne = async (
    photo: ComparePhoto,
    keep: "small" | "deleted",
  ): Promise<string | undefined> => {
    const keys = keysToDelete(photo, keep);
    if (keys.length === 0) return "Its image in R2 isn't known.";
    try {
      return failureMessage(await mutation.mutateAsync(keys));
    } catch (error) {
      return errorMessage(error);
    }
  };
  const discard = async (photos: ComparePhoto[], keep: "small" | "deleted") => {
    const failures: DiscardFailure[] = [];
    for (const photo of photos) {
      const message = await discardOne(photo, keep);
      if (message) failures.push({ path: photo.file.path, name: comparePhotoName(photo), message });
    }
    return failures;
  };
  return discard;
}
