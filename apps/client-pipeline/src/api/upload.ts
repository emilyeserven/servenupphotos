import { type UseMutationResult, mutationOptions } from "@tanstack/react-query";
import type { BucketImage } from "@/api/photos";
import type { PublishedName } from "@/api/versions";
import type { Crop } from "@/lib/crop";

/** Where an object ended up in R2. */
interface UploadedObject {
  key: string;
  url: string;
}

/** Where an uploaded photo, its resized WEBP versions and its square thumbnail ended up in R2. */
export interface UploadResponse extends UploadedObject {
  versions: Record<PublishedName, UploadedObject>;
}

/** What Cloudflare answered to a failed request. */
export interface CloudflareResponse {
  /** HTTP status, missing when no response arrived. */
  status?: number;
  /** The S3 error code and message, as listed in https://developers.cloudflare.com/r2/api/error-codes/ */
  code?: string;
  message?: string;
  requestId?: string;
  /** The whole error, as the backend's S3 client reported it. */
  error: string;
}

export interface UploadRequest {
  photo: File;
  /** Upload even when the bucket already has a different photo under this name. */
  keepSameName?: boolean;
  /** The square the thumbnail is cut from; the middle of the photo when left out. */
  crop?: Crop;
}

/** A failed upload, with the photos already under that name or Cloudflare's answer when known. */
export class UploadError extends Error {
  constructor(
    message: string,
    /** Other photos in the bucket under the same name, newest first, when that stopped the upload. */
    readonly sameName: BucketImage[] = [],
    readonly cloudflare?: CloudflareResponse,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

type UploadErrorBody = {
  message?: string;
  sameName?: BucketImage[];
  cloudflare?: CloudflareResponse;
};

async function uploadPhoto({ photo, keepSameName, crop }: UploadRequest): Promise<UploadResponse> {
  const body = new FormData();
  // The backend reads fields that come before the photo.
  if (keepSameName) body.append("sameName", "keep");
  if (crop) {
    body.append("cropX", String(Math.round(crop.x)));
    body.append("cropY", String(Math.round(crop.y)));
    body.append("cropSize", String(Math.round(crop.size)));
  }
  body.append("photo", photo);

  const res = await fetch("/api/upload", { method: "POST", body });
  if (!res.ok) throw await toUploadError(res);
  return (await res.json()) as UploadResponse;
}

async function toUploadError(res: Response): Promise<UploadError> {
  const json = (await res.json().catch(() => ({}))) as UploadErrorBody;
  const message = json.message ?? `/api/upload responded ${res.status}`;
  return new UploadError(message, json.sameName, json.cloudflare);
}

/** photo under a new name, keeping its .jpg extension. */
export function renamePhoto(photo: File, stem: string): File {
  return new File([photo], `${stem.trim()}.jpg`, {
    type: photo.type,
    lastModified: photo.lastModified,
  });
}

export const uploadMutation = mutationOptions({
  mutationKey: ["upload"],
  mutationFn: uploadPhoto,
});

export type UploadMutation = UseMutationResult<UploadResponse, Error, UploadRequest>;
