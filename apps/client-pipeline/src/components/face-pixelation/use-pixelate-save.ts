import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savedFacesQuery } from "@/api/faces";
import { regenerateVersionsMutation } from "@/api/versions";
import type { Editable } from "@/components/edit-in-flight/photo-json";
import type { Edit, Save } from "@/components/edit-in-flight/use-edit";
import { type FaceBox, withFacesMark } from "@/lib/face-boxes";

/**
 * Remakes every version of the photo in R2 with faces pixelated (none stops pixelating), then saves
 * its JSON with every version's URL marked anew, through the Photo page's own save, so browsers and
 * Cloudflare fetch the remade versions. Other unsaved edits on the page stay unsaved.
 */
export function usePixelateSave({ image }: Editable, edit: Edit, save: Save) {
  const queryClient = useQueryClient();
  const regenerate = useMutation(regenerateVersionsMutation);
  const mutation = useMutation({
    mutationFn: async (faces: FaceBox[]) => {
      await regenerate.mutateAsync({ key: image.key, faces });
      const data = {
        ...edit.savedData,
        images: withFacesMark(edit.savedData.images, Date.now().toString(36)),
      };
      await save.mutation.mutateAsync({ crop: null, data });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: savedFacesQuery(image.key).queryKey }),
  });
  /** The versions were remade with the faces, but saving the JSON failed. */
  const remadeOnly = mutation.isError && regenerate.isSuccess;
  return { mutation, remadeOnly };
}

/** Pixelating the versions, from `usePixelateSave`. */
export type PixelateSave = ReturnType<typeof usePixelateSave>;
