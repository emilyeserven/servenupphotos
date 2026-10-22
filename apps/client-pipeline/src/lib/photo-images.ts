import type { SanitizedExif } from "@/api/exif";
import type { UploadResponse } from "@/api/upload";
import { thumbnailCropField } from "@/api/versions";

/** The Square Thumbnail's crop as the photo's JSON saves it, when the upload said what it was. */
function uploadedCrop({ thumbnailCrop }: UploadResponse) {
  return thumbnailCrop ? thumbnailCropField(thumbnailCrop) : null;
}

/** The sanitized EXIF with the photo's R2 URLs and key filled in once it has been uploaded. */
export function withImages(
  sanitized: SanitizedExif | null | undefined,
  upload: UploadResponse | undefined,
): SanitizedExif | null {
  if (!sanitized || !upload) return sanitized ?? null;
  return {
    ...sanitized,
    images: {
      ...sanitized.images,
      full: upload.url,
      key: upload.key,
      xlarge: upload.versions.xlarge.url,
      large: upload.versions.large.url,
      medium: upload.versions.medium.url,
      small: upload.versions.small.url,
      xsmall: upload.versions.xsmall.url,
      preview: upload.versions.preview.url,
      thumbnail: upload.versions.thumbnail.url,
      thumbnailpreview: upload.versions.thumbnailpreview.url,
      thumbnailcrop: uploadedCrop(upload),
    },
  };
}
