import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bucketImagesQuery,
  deletePhotoMutation,
  photosInFlightQuery,
  publishedPhotosQuery,
} from "@/api/photos";
import { ConfirmDeleteCard } from "@/components/confirm-delete-card";
import { useDeletedPhotoStore } from "@/stores/deleted-photo";

/** Deletes a photo, keeps what that did for the Photo page to show, and reads the photos again. */
function usePhotoDelete() {
  const queryClient = useQueryClient();
  const setResult = useDeletedPhotoStore((state) => state.setResult);
  return useMutation({
    ...deletePhotoMutation,
    onSuccess: (result) => {
      // Set first, so the page shows what happened instead of saying the photo isn't there.
      setResult(result);
      for (const query of [photosInFlightQuery, publishedPhotosQuery, bucketImagesQuery]) {
        void queryClient.invalidateQueries({ queryKey: query.queryKey });
      }
    },
  });
}

interface DeletePhotoCardProps {
  /** The photo JSON file's path. */
  path: string;
  /** The photo's JSON as last saved, whose title names it in the question. */
  saved: Record<string, unknown>;
  /** What names the photo when it has no title, such as its file name. */
  fallbackTitle: string;
  disabled?: boolean;
}

/**
 * The Photo page's Delete photo card: a button that asks first, saying what goes with the photo,
 * then deletes its JSON and its references as changes waiting for Commit, and its images from R2.
 */
export function DeletePhotoCard({ path, saved, fallbackTitle, disabled }: DeletePhotoCardProps) {
  const remove = usePhotoDelete();
  const name = typeof saved.title === "string" && saved.title ? saved.title : fallbackTitle;
  return (
    <ConfirmDeleteCard
      action="Delete photo"
      description="Deletes the photo and its images for good. Its JSON goes at the next Commit; its images leave R2 right away."
      question={`Delete “${name}”?`}
      note="Its images can't be brought back, even by discarding the change."
      remove={{ ...remove, run: () => remove.mutate(path) }}
      disabled={disabled}
    >
      <DeleteConsequences />
    </ConfirmDeleteCard>
  );
}

/** What deleting a photo does, to its own files and to everything that points at it. */
function DeleteConsequences() {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
      <li>
        Its JSON file is deleted, waiting for Commit. A photo already in the portfolio leaves it
        when the pull request merges.
      </li>
      <li>
        It&apos;s taken out of every album&apos;s photo order, covers and layout, other photos&apos;
        Unselected winners, the bio, viewer likes, photo books and trip lines.
      </li>
      <li className="text-destructive">
        Its image, every resized version, the Square Thumbnail and any unedited original are deleted
        from R2 now.
      </li>
    </ul>
  );
}
