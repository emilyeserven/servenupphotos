/**
 * How long the BFF waits for the backend on paths that take longer than DEFAULT_TIMEOUT_MS, each a
 * little longer than the backend gives the work itself. The longest matching prefix wins.
 */
const TIMEOUTS: Record<string, number> = {
  // The backend may first read the camera overrides from GitHub, given 30s, before reading the photo.
  "/exif": 90_000,
  // The backend gives resizing and R2 120s after receiving the photo.
  "/upload": 150_000,
  // A resized WEBP version of an uploaded photo, as an upload would put in R2.
  "/photos/versions/": 60_000,
  // Saving a photo may read its colors from R2, given 20s, then GitHub, given 30s.
  "/photos/github": 55_000,
  // Removing a photo waiting for Commit gives GitHub 30s, then R2 15s.
  "/photos/in-flight": 50_000,
  // Reads every photo file; the backend gives GitHub 60s.
  "/photos/groups": 65_000,
  // The photos already in the portfolio; the backend gives GitHub 30s, then R2 15s.
  "/photos/published": 50_000,
  // Commit; the backend gives GitHub 60s.
  "/photos/combined": 65_000,
  // Downloads an original JPEG from R2 to pass on; the backend gives that 60s.
  "/photos/original": 65_000,
  // Downloads an original from R2, given 30s, then reads it as /exif does.
  "/photos/bucket/exif": 90_000,
  // Remakes a photo's resized versions; the backend gives that 120s.
  "/photos/bucket/versions": 150_000,
  // Update Data reads every photo file; the backend gives GitHub 60s.
  "/data/": 65_000,
  // Answers from memory while a Missing fields or Colors read runs.
  "/data/progress/": 5_000,
  // May download originals from R2 to read their EXIF; the backend gives that 3 minutes.
  "/data/missing-fields": 190_000,
  // Lists the bucket and copies renamed photos in R2; the backend gives that 5 minutes.
  "/data/image-names": 310_000,
  // Downloads the originals from R2 to read their colors; the backend gives that 5 minutes.
  "/data/colors": 310_000,
  // Reads every photo file; the backend gives GitHub 60s.
  "/publish/": 65_000,
};

/** The wait for every other path: the backend gives GitHub 30s for most reads and saves. */
const DEFAULT_TIMEOUT_MS = 35_000;

/** How long to wait for the backend to answer path, by TIMEOUTS; its query is left out. */
export function timeoutFor(path: string): number {
  const { pathname } = new URL(path, "http://backend");
  const matches = Object.entries(TIMEOUTS)
    .filter(([prefix]) => pathname.startsWith(prefix))
    .toSorted(([a], [b]) => b.length - a.length);
  return matches[0]?.[1] ?? DEFAULT_TIMEOUT_MS;
}
