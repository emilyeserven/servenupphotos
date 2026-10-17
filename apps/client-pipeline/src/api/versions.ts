import { queryOptions } from "@tanstack/react-query";

/** The resized WEBP versions every upload puts in R2 next to the original JPEG. */
export const VERSIONS = [
  { name: "xlarge", label: "X-Large", maxEdge: 1800 },
  { name: "large", label: "Large", maxEdge: 1200 },
  { name: "medium", label: "Medium", maxEdge: 500 },
  { name: "small", label: "Small", maxEdge: 250 },
] as const;

export type VersionName = (typeof VERSIONS)[number]["name"];

/** The R2 keys of the resized versions uploaded with the original at key, as the backend names them. */
export function versionKeys(key: string): string[] {
  const stem = key.replace(/\.[^./]*$/, "");
  return VERSIONS.map((version) => `${stem}-${version.name}.webp`);
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
