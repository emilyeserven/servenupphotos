import { squareThumbnailUrl, thumbnailPreviewUrl } from "@/api/versions";

/**
 * The address of a Square Thumbnail, Thumbnail Preview, Small or X-Small version in the backend's offline
 * copy: the backend serves it from disk, downloading it from R2 the first time, so it still shows
 * when the internet can't be reached.
 */
function offlineThumbnailUrl(url: string): string {
  return `/api/thumbnails?${new URLSearchParams({ url })}`;
}

/**
 * The images the offline copy keeps: the Square Thumbnail, its Thumbnail Preview, and the Small and
 * X-Small versions.
 */
const KEPT_OFFLINE = /-(?:thumbnail|thumbnailpreview|small|xsmall)\.webp(?:\?.*)?$/;

/** url from the offline copy when it's an image the copy keeps, or else url itself, straight from R2. */
export function offlineImageUrl(url: string): string {
  return KEPT_OFFLINE.test(url) ? offlineThumbnailUrl(url) : url;
}

/** A resized WEBP version's name at the end of its URL, or an original's extension. */
const VERSION_ENDING =
  /(?:-(?:xlarge|large|medium|small|xsmall|preview)\.webp|\.jpe?g)(?:[?#].*)?$/i;

/**
 * The Small version (500 px on its long edge, in the photo's own proportions) from the offline copy,
 * for a photo whose original or resized version is at url; undefined for any other URL. Pages show
 * it when the larger image can't be loaded, such as offline.
 */
export function offlineSmallUrl(url: string): string | undefined {
  if (!VERSION_ENDING.test(url)) return undefined;
  return offlineThumbnailUrl(url.replace(VERSION_ENDING, "-small.webp"));
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
 * A small square tile's image for the photo with data, from the offline copy: its Square Thumbnail,
 * or else its Small version; undefined when its JSON saves neither.
 */
export function tileImageUrl(data: unknown): string | undefined {
  return offlineUrl(savedImageUrl(data, "thumbnail") ?? savedImageUrl(data, "small"));
}

/**
 * A photo's X-Small version (250px on its long edge, in its own shape) from the offline copy, for the
 * album layout preview; undefined when its JSON saves none.
 */
export function offlineXSmallUrl(data: unknown): string | undefined {
  return offlineUrl(savedImageUrl(data, "xsmall"));
}
