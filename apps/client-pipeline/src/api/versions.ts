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

async function fetchVersion(photo: File, version: VersionName): Promise<Blob> {
  const body = new FormData();
  body.append("photo", photo);
  const res = await fetch(`/api/photos/versions/${version}`, { method: "POST", body });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(json.message ?? `/api/photos/versions/${version} responded ${res.status}`);
  }
  return res.blob();
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
