import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyAlbumSuggestionsMutation } from "@/api/album-suggestions";
import { organizeQuery, setAlbumPhotoOrderMutation } from "@/api/organize";
import { savePhotoBookMutation } from "@/api/photo-books";
import { invalidatePhotoReads } from "@/components/update-data-shared";
import type { ImportSaves } from "@/lib/book-import-save";

/**
 * Saves an import, one step after another, each a change waiting for Commit: the album's photos
 * (making the album when it's new), the new album's photo order, then the photo book.
 * Each step is its own mutation, so the combined lists show every change as it's saved.
 */
export function useImportBook() {
  const queryClient = useQueryClient();
  const albums = useMutation(applyAlbumSuggestionsMutation);
  const order = useMutation(setAlbumPhotoOrderMutation);
  const book = useMutation(savePhotoBookMutation);
  return useMutation({
    mutationKey: ["photobooks", "import"],
    mutationFn: async (saves: ImportSaves) => {
      if (saves.albumSave) await albums.mutateAsync(saves.albumSave);
      if (saves.photoOrder.length > 0) {
        await order.mutateAsync({ id: saves.album.id, photoIds: saves.photoOrder });
      }
      return book.mutateAsync(saves.book);
    },
    onSettled: () => {
      invalidatePhotoReads(queryClient);
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
    },
  });
}
