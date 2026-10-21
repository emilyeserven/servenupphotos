import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/settings";

/** The resized WEBP versions every upload puts in R2 next to the original JPEG. */
export const VERSIONS = [
  { name: "xlarge", label: "X-Large", maxEdge: 2500 },
  { name: "large", label: "Large", maxEdge: 1800 },
  { name: "medium", label: "Medium", maxEdge: 1200 },
  { name: "small", label: "Small", maxEdge: 500 },
  { name: "xsmall", label: "X-Small", maxEdge: 250 },
  // A tiny, low-quality placeholder to show blurred while a real version loads.
  { name: "preview", label: "Preview", maxEdge: 40 },
] as const;

export type VersionName = (typeof VERSIONS)[number]["name"];

/**
 * The square crop every upload also puts in R2, for square tiles like the portfolio's Grid. It's
 * always exactly maxEdge × maxEdge, scaled up or down from whatever size the crop is on the photo.
 */
export const THUMBNAIL = { name: "thumbnail", label: "Square Thumbnail", maxEdge: 500 } as const;

/** Every WEBP an upload puts next to the original: the resized versions, then the thumbnail. */
export const PUBLISHED = [...VERSIONS, THUMBNAIL] as const;

export type PublishedName = (typeof PUBLISHED)[number]["name"];

/** The R2 keys of the WEBPs uploaded with the original at key, as the backend names them. */
export function versionKeys(key: string): string[] {
  const stem = keyStem(key);
  return PUBLISHED.map((version) => `${stem}-${version.name}.webp`);
}

/** The Square Thumbnail's URL, next to the original's at url, as the backend names it. */
export function squareThumbnailUrl(url: string): string {
  return `${keyStem(url)}-${THUMBNAIL.name}.webp`;
}

/** A key without its file extension. */
export function keyStem(key: string): string {
  return key.replace(/\.[^./]*$/, "");
}

/** The resized version or thumbnail an R2 key names, and the original's key without its extension. */
export function parseVersionKey(
  key: string,
): { originalStem: string; version: (typeof PUBLISHED)[number] } | undefined {
  const [, originalStem, name] = /^(.*)-([a-z]+)\.webp$/.exec(key) ?? [];
  const version = PUBLISHED.find((v) => v.name === name);
  if (originalStem === undefined || !version) return undefined;
  return { originalStem, version };
}

/** A resized version as an upload would make it, and how big it would be as a JPEG instead. */
interface VersionPreview {
  webp: Blob;
  /** The same version as a JPEG at the original's quality, when the backend said. */
  jpeg?: JpegComparison;
}

/** How big a version would be as a JPEG saved at the original photo's own quality. */
export interface JpegComparison {
  bytes: number;
  quality: number;
}

async function fetchVersion(photo: File, version: VersionName): Promise<VersionPreview> {
  const body = new FormData();
  body.append("photo", photo);
  const res = await fetch(`/api/photos/versions/${version}`, { method: "POST", body });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(json.message ?? `/api/photos/versions/${version} responded ${res.status}`);
  }
  return { webp: await res.blob(), jpeg: jpegComparison(res.headers) };
}

/** The JPEG comparison the backend sends in headers, when it sent one. */
function jpegComparison(headers: Headers): JpegComparison | undefined {
  const bytes = Number(headers.get("x-jpeg-bytes"));
  const quality = Number(headers.get("x-jpeg-quality"));
  return bytes > 0 && quality > 0 ? { bytes, quality } : undefined;
}

/** One version of photo, made the same way an upload makes it, before anything is uploaded. */
export const versionPreviewQuery = (photo: File, version: VersionName) =>
  queryOptions({
    queryKey: ["versions", photo.name, photo.size, photo.lastModified, version],
    queryFn: () => fetchVersion(photo, version),
    staleTime: Infinity,
    // Blobs can be large, so they are dropped soon after the photo changes.
    gcTime: 60_000,
  });

/** Where the remade versions of a photo in R2 ended up, by version name. */
interface RegenerateResult {
  key: string;
  versions: Partial<Record<PublishedName, { key: string; url: string }>>;
}

/**
 * Makes resized versions of the original at key, already in R2, again from that original and
 * uploads them over any already there; every version and the Square Thumbnail when versions is
 * left out. The Square Thumbnail keeps the crop saved with the one already in R2, or is cut from
 * the middle of the photo when there isn't one.
 */
export const regenerateVersionsMutation = mutationOptions({
  mutationKey: ["photos", "bucket", "versions"],
  mutationFn: (request: { key: string; versions?: PublishedName[] }) =>
    requestJson<RegenerateResult>("/api/photos/bucket/versions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
});
