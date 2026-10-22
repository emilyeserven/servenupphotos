import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { savedGroups } from "@/api/organize";
import {
  type UpdateResult,
  photosInFlightQuery,
  publishedPhotosQuery,
  updateInFlightMutation,
} from "@/api/photos";
import { regenerateVersionsMutation, thumbnailCropQuery } from "@/api/versions";
import { useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { savedDetails } from "@/components/photo-details";
import { type Crop } from "@/lib/crop";
import {
  type Editable,
  type PhotoJson,
  SQUARE_NAMES,
  type SaveRequest,
  type SquareUrls,
  cropChanged,
  fieldsChanged,
  madeUrls,
  markedUrls,
  newFileName,
  nextJson,
  renamedInFlight,
  saveRequest,
  squareUrls,
  withSquares,
} from "@/components/edit-in-flight/photo-json";

/** The crop, title, place name, comment, albums and tags being edited, against the last ones saved, and the JSON saving them would write. */
export function useEdit({ file, data, image }: Editable, savedCrop: Crop | null) {
  const [crop, setCrop] = useState<Crop | null>(savedCrop);
  // The editor reports the middle first when no crop was saved, which then counts as saved.
  const [baseline, setBaseline] = useState<Crop | null>(savedCrop);
  const [savedData, setSavedData] = useState(data);
  const [details, setDetails] = useState(() => savedDetails(data));
  const [groups, setGroups] = useState(() => savedGroups(data));
  const remakeSquares = cropChanged(crop, baseline, savedData);
  const changed = remakeSquares || fieldsChanged(savedData, details, groups);
  const request = {
    ...saveRequest(savedData, details, groups, crop, baseline, remakeSquares),
    name: newFileName(file, savedData, details.title),
  };
  return {
    crop,
    baseline,
    savedData,
    details,
    setDetails,
    groups,
    setGroups,
    /** What saving would do, when there's anything to save. */
    request: changed ? request : null,
    /** The JSON saving would write, when there's anything to save. */
    next: changed ? nextJson(request, image.url) : null,
    onCropChange: (next: Crop) => {
      setCrop(next);
      setBaseline((current) => current ?? next);
    },
    reset: () => setCrop(baseline),
    onSaved: (saved: Crop | null, json: PhotoJson) => {
      if (saved) setBaseline(saved);
      setSavedData(json);
    },
  };
}

/** The edit in progress, from `useEdit`. */
export type Edit = ReturnType<typeof useEdit>;

interface SaveResult {
  crop: Crop | null;
  data: PhotoJson;
  /** The square versions' new URLs, marked with the crop, when they were remade. */
  squares: SquareUrls | null;
  update: UpdateResult;
}

/**
 * Remakes the Square Thumbnail and its Thumbnail Preview in R2 from a crop, when there is one, then
 * saves the photo's JSON, with their URLs marked with that crop, over the file in the pull request.
 */
export function useSave(
  { file, image }: Editable,
  onSaved: (crop: Crop | null, data: PhotoJson) => void,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rebuild = useAllPhotosRebuild(true, () => {
    void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
  });
  const regenerate = useMutation(regenerateVersionsMutation);
  const update = useMutation(updateInFlightMutation);
  const mutation = useMutation({
    mutationFn: async ({ crop, data, name }: SaveRequest): Promise<SaveResult> => {
      if (!crop) {
        const updated = await update.mutateAsync({ path: file.path, data, name });
        return { crop, data, squares: null, update: updated };
      }
      const made = await regenerate.mutateAsync({ key: image.key, versions: SQUARE_NAMES, crop });
      const urls = { ...squareUrls(data, image.url), ...madeUrls(made.versions) };
      const next = withSquares(data, urls, crop);
      const updated = await update.mutateAsync({ path: file.path, data: next, name });
      return { crop, data: next, squares: markedUrls(urls, crop), update: updated };
    },
    onSuccess: (result) => {
      onSaved(result.crop, result.data);
      if (result.update.path !== file.path) {
        // Follow the file to its new name, in the cache until the pull request is read again.
        queryClient.setQueryData(
          photosInFlightQuery.queryKey,
          (data) => data && renamedInFlight(data, file.path, result.update),
        );
        void navigate({ to: "/exif", search: { edit: result.update.path }, replace: true });
      }
      void queryClient.invalidateQueries({ queryKey: thumbnailCropQuery(image.key).queryKey });
      void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
      if (!result.update.changed) return;
      // A photo already in the portfolio is in the pull request after its first save.
      void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
      rebuild.afterPush();
    },
  });
  // The thumbnail was remade when only saving the JSON failed.
  const remadeOnly = mutation.isError && update.isError;
  return { mutation, rebuild, remadeOnly };
}

/** Saving the edit, from `useSave`. */
export type Save = ReturnType<typeof useSave>;
