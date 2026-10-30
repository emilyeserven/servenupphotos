import { squareThumbnailUrl, thumbnailPreviewUrl } from "@/api/versions";

/**
 * The address of a Square Thumbnail or Thumbnail Preview in the backend's offline copy: the
 * backend serves it from disk, downloading it from R2 the first time, so it still shows when the
 * internet can't be reached.
 */
function offlineThumbnailUrl(url: string): string {
  return `/api/thumbnails?${new URLSearchParams({ url })}`;
}

/** The image the photo's JSON saves as `images.<name>`, when it saves one. */
function savedImageUrl(data: unknown, name: string): string | undefined {
  const saved = (data as { images?: Record<string, unknown> } | undefined)?.images?.[name];
  return typeof saved === "string" && saved ? saved : undefined;
}

/** The image saved in the photo's JSON as `images.<name>`, or else `name` next to its image in R2. */
function pickedUrl(data: unknown, imageUrl: string | undefined, name: string): string | undefined {
  const saved = savedImageUrl(data, name);
  if (saved || !imageUrl) return saved;
  return name === "thumbnail" ? squareThumbnailUrl(imageUrl) : thumbnailPreviewUrl(imageUrl);
}

/** url in the offline copy, when there is one. */
function offlineUrl(url: string | undefined): string | undefined {
  return url && offlineThumbnailUrl(url);
}

/**
 * A photo's Square Thumbnail and Thumbnail Preview from the offline copy: the ones saved in its
 * JSON, or else the ones next to its image in R2. Undefined when it has neither.
 */
export function squareImages(
  data: unknown,
  imageUrl?: string,
): { square: string; preview?: string } | undefined {
  const square = offlineUrl(pickedUrl(data, imageUrl, "thumbnail"));
  if (!square) return undefined;
  return { square, preview: offlineUrl(pickedUrl(data, imageUrl, "thumbnailpreview")) };
}

/**
 * A photo's X-Small version (250px on its long edge, in its own shape) from the offline copy, for the
 * album layout preview; undefined when its JSON saves none.
 */
export function offlineXSmallUrl(data: unknown): string | undefined {
  return offlineUrl(savedImageUrl(data, "xsmall"));
}
