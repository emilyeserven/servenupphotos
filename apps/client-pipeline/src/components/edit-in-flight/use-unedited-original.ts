import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { exifMutation, type SanitizedExif } from "@/api/exif";
import { photosInFlightQuery, publishedPhotosQuery, updateInFlightMutation } from "@/api/photos";
import { renamePhoto, uploadMutation } from "@/api/upload";
import { regenerateVersionsMutation } from "@/api/versions";
import { type Editable, type PhotoJson, photoFile } from "@/components/edit-in-flight/photo-json";
import { newSize } from "@/components/edit-in-flight/replace-image";
import type { PixelateSave } from "@/components/face-pixelation/use-pixelate-save";
import type { FaceBox } from "@/lib/face-boxes";
import {
  type OriginalCrop,
  type OriginalEntry,
  originalFromJson,
  originalUploadName,
  pixelatedOriginal,
  savedFaces,
  uploadedOriginal,
  withOriginal,
} from "@/lib/unedited-original";

/** The chosen JPEG and its size, once its EXIF has been read. */
function chosenOriginal(photo: File | undefined, sanitized: SanitizedExif | null | undefined) {
  const size = newSize(sanitized);
  if (!photo || !size) throw new Error("Choose the unedited original's JPEG first.");
  return { photo, size };
}

/** Reads the photo files again, so the page starts over from what was just saved. */
function refetchSaved(queryClient: QueryClient) {
  for (const query of [photosInFlightQuery, publishedPhotosQuery]) {
    void queryClient.invalidateQueries({ queryKey: query.queryKey });
  }
}

/** The saved original, or an error saying there's none to change. */
function existing(original: OriginalEntry | null): OriginalEntry {
  if (!original) throw new Error("This photo has no unedited original.");
  return original;
}

/** Saves the photo's JSON with its original set to entry, or taken off when that's null. */
type SaveOriginal = (entry: OriginalEntry | null) => Promise<unknown>;

/** Reading the chosen original's size, then uploading it with its versions and saving it. */
function useAddOriginal(saved: PhotoJson, save: SaveOriginal, onSaved: () => void) {
  const read = useMutation(exifMutation);
  const upload = useMutation(uploadMutation);
  const add = useMutation({
    mutationFn: async () => {
      const chosen = chosenOriginal(read.variables, read.data?.sanitized);
      const uploaded = await upload.mutateAsync({
        photo: renamePhoto(chosen.photo, originalUploadName(photoFile(saved))),
        // Uploading the same original again, or one named like another photo, is fine.
        keepSameName: true,
      });
      return save(uploadedOriginal(uploaded, chosen.photo.name, chosen.size));
    },
    onSuccess: () => {
      read.reset();
      onSaved();
    },
  });
  return { read, add };
}

/**
 * Remaking the original's versions with the areas being edited, then saving them with the photo's
 * own areas as matched, as the face editor saves.
 */
function usePixelateOriginal(
  saved: PhotoJson,
  original: OriginalEntry | null,
  save: SaveOriginal,
  onSaved: () => void,
): PixelateSave {
  const regenerate = useMutation(regenerateVersionsMutation);
  const mutation = useMutation({
    mutationFn: async (faces: FaceBox[]) => {
      const entry = existing(original);
      await regenerate.mutateAsync({ key: String(entry.images.key ?? ""), faces });
      const mark = Date.now().toString(36);
      await save(pixelatedOriginal(entry, faces, savedFaces(saved), mark));
    },
    onSuccess: onSaved,
  });
  return { mutation, remadeOnly: mutation.isError && regenerate.isSuccess };
}

/**
 * A saved photo's unedited original: uploading one (or another in its place) to R2 with its resized
 * versions, the part of it the edit shows, pixelating faces on its versions, showing it on the
 * portfolio or not, and taking it off the photo. Each saves the photo's JSON as a change waiting
 * for Commit.
 */
export function useUneditedOriginal({ file }: Editable, saved: PhotoJson) {
  const queryClient = useQueryClient();
  const update = useMutation(updateInFlightMutation);
  const original = originalFromJson(saved);
  const save: SaveOriginal = (entry) =>
    update.mutateAsync({ path: file.path, data: withOriginal(saved, entry) });
  const onSaved = () => refetchSaved(queryClient);
  const { read, add } = useAddOriginal(saved, save, onSaved);
  const pixelate = usePixelateOriginal(saved, original, save, onSaved);
  const change = useMutation({
    mutationFn: (next: (entry: OriginalEntry) => OriginalEntry | null) =>
      save(next(existing(original))),
    onSuccess: onSaved,
  });
  const pending = [read, add, change, pixelate.mutation].some((m) => m.isPending);

  return {
    /** The original as the photo's JSON saves it, or null when it has none. */
    original,
    /** Reading the chosen JPEG's EXIF, for its size, with the file as its variables. */
    read,
    /** Reads photo, the chosen original. */
    choose: (photo: File) => {
      add.reset();
      read.mutate(photo);
    },
    /** Uploading the chosen original and saving it on the photo. */
    add,
    /** Saving a change to the saved original: showing it, its crop, or taking it off. */
    change,
    /** Remaking the original's versions with the areas being edited, and saving them. */
    pixelate,
    /** Shows the original on the portfolio, or stops. */
    setShown: (shown: boolean) => change.mutate((entry) => ({ ...entry, showOnPortfolio: shown })),
    /** Saves the part of the original the edit shows. */
    setCrop: (crop: OriginalCrop) => change.mutate((entry) => ({ ...entry, crop })),
    /** Takes the original off the photo; its files stay in R2. */
    remove: () => change.mutate(() => null),
    /** Whether anything is being read, uploaded or saved, so nothing else can start. */
    busy: pending,
  };
}

/** The original's state and actions, from `useUneditedOriginal`. */
export type UneditedOriginal = ReturnType<typeof useUneditedOriginal>;
