import { useMutation } from "@tanstack/react-query";
import { regenerateVersionsMutation } from "@/api/versions";
import type { PhotoJson } from "@/components/edit-in-flight/photo-json";
import { facesFromJson, facesToReapply, withReappliedFaces } from "@/lib/face-json";

/**
 * Pixelating a photo's saved faces again after Replace image uploads its new original: when the new
 * image is the same size, every version at key is remade with the areas the JSON saves; when it
 * isn't, the areas are dropped from the JSON, since they'd be in the wrong places.
 */
export function useReapplyFaces(saved: PhotoJson) {
  const regenerate = useMutation(regenerateVersionsMutation);
  return {
    /** How many pixelated areas the photo's JSON saves, which a new image of the same size keeps. */
    savedAreas: facesFromJson(saved)?.length ?? 0,
    /** Remakes the versions at key with the saved faces if they still fit, and gives data to save. */
    reapply: async (key: string, data: PhotoJson, sameSize: boolean): Promise<PhotoJson> => {
      const faces = facesToReapply(saved, sameSize);
      if (faces.length > 0) await regenerate.mutateAsync({ key, faces });
      return withReappliedFaces(data, faces, Date.now().toString(36));
    },
  };
}
