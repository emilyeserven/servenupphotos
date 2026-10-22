import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { type UploadRequest, type UploadResponse, UploadError, uploadMutation } from "@/api/upload";
import {
  type PublishedName,
  type RegenerateResult,
  regenerateVersionsMutation,
  thumbnailUrlWithCrop,
} from "@/api/versions";
import { type Crop, sameCrop } from "@/lib/crop";

/** The versions cut from the Square Thumbnail's square, which moving it remakes. */
const SQUARES: PublishedName[] = ["thumbnail", "thumbnailpreview"];

/** What the R2 button does next: upload the photo, remake its Square Thumbnail, or nothing. */
export type R2Action = "upload" | "remake" | "done";

/**
 * Uploading the photo on the Photo page to R2, and afterwards remaking its Square Thumbnail and
 * Thumbnail Preview there whenever crop moves away from the square they were cut from.
 */
export function useR2Upload(crop: Crop | null) {
  const upload = useMutation(uploadMutation);
  const remake = useMutation(regenerateVersionsMutation);
  const [remade, setRemade] = useState<UploadResponse>();
  const uploaded = remade ?? withSentCrop(upload.data, upload.variables);
  const send = (request: UploadRequest) => upload.mutate(withCrop(request, crop));
  return {
    upload,
    remake,
    /** Where the photo and its versions are in R2, with the Square Thumbnail as last remade. */
    uploaded,
    pending: upload.isPending || remake.isPending,
    action: nextAction(uploaded, crop),
    /** Uploads request with the square as it is now. */
    send,
    /** Uploads what was last tried, so a new name sticks, or else photo. */
    retry: (photo: File) => send(upload.variables ?? { photo }),
    /** Remakes the square versions from crop over the uploaded ones. */
    remakeSquare: () => {
      if (!uploaded || !crop) return;
      remake.mutate(
        { key: uploaded.key, versions: SQUARES, crop },
        { onSuccess: (made) => setRemade(withSquares(uploaded, made, crop)) },
      );
    },
    /** Forgets the upload, for a new photo. */
    reset: () => {
      upload.reset();
      remake.reset();
      setRemade(undefined);
    },
  };
}

/** The Photo page's R2 upload, from `useR2Upload`. */
export type R2Upload = ReturnType<typeof useR2Upload>;

function withCrop(request: UploadRequest, crop: Crop | null): UploadRequest {
  return crop ? { ...request, crop } : request;
}

/**
 * The upload with the square it sent as its Square Thumbnail's, so the square as it is now is
 * compared with exactly what was sent; the backend's answer when no square was sent.
 */
function withSentCrop(
  data: UploadResponse | undefined,
  sent: UploadRequest | undefined,
): UploadResponse | undefined {
  return data && { ...data, thumbnailCrop: sent?.crop ?? data.thumbnailCrop };
}

function nextAction(uploaded: UploadResponse | undefined, crop: Crop | null): R2Action {
  if (!uploaded) return "upload";
  return squareMoved(uploaded.thumbnailCrop, crop) ? "remake" : "done";
}

/** Whether crop is a different square from the one the uploaded Square Thumbnail was cut from. */
function squareMoved(cut: Crop | undefined, crop: Crop | null): boolean {
  if (!cut || !crop) return false;
  return !sameCrop(cut, crop);
}

/**
 * uploaded with the remade square versions' URLs, marked with crop so browsers and Cloudflare's
 * cache fetch the new ones, and crop as its square.
 */
function withSquares(uploaded: UploadResponse, made: RegenerateResult, crop: Crop): UploadResponse {
  const versions = { ...uploaded.versions };
  for (const name of SQUARES) {
    const object = made.versions[name];
    if (object) versions[name] = { ...object, url: thumbnailUrlWithCrop(object.url, crop) };
  }
  return { ...uploaded, versions, thumbnailCrop: crop };
}

/** The error that stopped the upload because the bucket has a photo with the same name. */
export function sameNameError(error: Error | null): UploadError | undefined {
  if (error instanceof UploadError && error.sameName.length > 0) return error;
  return undefined;
}
