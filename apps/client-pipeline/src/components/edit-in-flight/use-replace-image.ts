import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { exifMutation, type SanitizedExif } from "@/api/exif";
import { photosInFlightQuery, publishedPhotosQuery, updateInFlightMutation } from "@/api/photos";
import { renamePhoto, uploadMutation } from "@/api/upload";
import { thumbnailCropQuery } from "@/api/versions";
import { fileStem } from "@/components/photo-details";
import { type Editable, type PhotoJson, photoFile } from "@/components/edit-in-flight/photo-json";
import {
  newSize,
  replacedJson,
  sameSize,
  savedSize,
} from "@/components/edit-in-flight/replace-image";
import { useLensSettings } from "@/components/edit-in-flight/use-edit";
import { type Crop } from "@/lib/crop";
import { useReplacedImageStore } from "@/stores/replaced-image";

/**
 * Replacing a saved photo's image with a new JPEG, such as a re-edit of the same shot: reading the
 * new image's EXIF, the square its Square Thumbnail is cut from (the saved one when the new image is
 * the same size, or else one picked on it), uploading it with every version, and saving the photo's
 * JSON with its new links as a change waiting for Commit.
 */
export function useReplaceImage({ file }: Editable, saved: PhotoJson, savedCrop: Crop | null) {
  const queryClient = useQueryClient();
  const settings = useLensSettings();
  const note = useReplacedImageStore((state) => state.note);
  const read = useMutation(exifMutation);
  const [newCrop, setNewCrop] = useState<Crop | null>(null);
  const [refreshExif, setRefreshExif] = useState(false);
  const upload = useMutation(uploadMutation);
  const update = useMutation(updateInFlightMutation);
  const square = squareFor(read.data?.sanitized, saved, savedCrop, newCrop);

  const replace = useMutation({
    mutationFn: async () => {
      const chosen = chosenImage(read.variables, read.data?.sanitized);
      const uploaded = await upload.mutateAsync({
        photo: sameName(chosen.photo, saved),
        // The re-edit usually has the old image's name, which the bucket already has.
        keepSameName: true,
        crop: square.crop ?? undefined,
      });
      const replacement = { sanitized: chosen.sanitized, refreshExif };
      const data = replacedJson(saved, uploaded, replacement, settings);
      const updated = await update.mutateAsync({ path: file.path, data });
      return { key: uploaded.key, path: updated.path, name: chosen.photo.name };
    },
    onSuccess: ({ key, path, name }) => {
      note(path, name);
      read.reset();
      // The editor starts over from the saved file, with the new image.
      for (const query of [thumbnailCropQuery(key), photosInFlightQuery, publishedPhotosQuery]) {
        void queryClient.invalidateQueries({ queryKey: query.queryKey });
      }
    },
  });

  return {
    /** Reading the new image's EXIF, with the chosen file as its variables. */
    read,
    /** Reads photo, the new image, starting its square and choices over. */
    choose: (photo: File) => {
      setNewCrop(null);
      replace.reset();
      read.mutate(photo);
    },
    /** Whether the new image is the same size as the old, so the saved square is kept. */
    keepsCrop: square.keepsCrop,
    /** Whether there's a square to cut the new Square Thumbnail from yet. */
    hasCrop: square.crop !== null,
    /** The square picked on a new image of another size. */
    newCrop,
    setNewCrop,
    refreshExif,
    setRefreshExif,
    replace,
    /** Whether only saving the JSON failed, after the new image was uploaded. */
    uploadedOnly: replace.isError && upload.isSuccess,
  };
}

/**
 * The square to cut the new image's Square Thumbnail from: the saved one when the new image is the
 * same size as the old, or else the one picked on it.
 */
function squareFor(
  sanitized: SanitizedExif | null | undefined,
  saved: PhotoJson,
  savedCrop: Crop | null,
  newCrop: Crop | null,
): { keepsCrop: boolean; crop: Crop | null } {
  const keepsCrop = sameSize(savedSize(saved), newSize(sanitized));
  return { keepsCrop, crop: keepsCrop ? savedCrop : newCrop };
}

/** The chosen JPEG and its EXIF, once it has been read. */
function chosenImage(photo: File | undefined, sanitized: SanitizedExif | null | undefined) {
  if (!photo || !sanitized) throw new Error("Choose the new JPEG first.");
  return { photo, sanitized };
}

/** The replace in progress, from `useReplaceImage`. */
export type ReplaceImage = ReturnType<typeof useReplaceImage>;

/**
 * photo under the saved photo's original file name, so its R2 key has the same name as the old
 * image's and the JSON's `file` still names it; photo as it is when the JSON has no file name.
 */
function sameName(photo: File, saved: PhotoJson): File {
  const stem = fileStem(photoFile(saved));
  return stem ? renamePhoto(photo, stem) : photo;
}
