/** How long the BFF waits for the backend: the wait for every path, and for paths by prefix, in ms. */
export interface RelayTimeouts {
  /** The wait for a path no prefix matches. */
  defaultMs: number;
  /** The wait for the paths starting with each prefix; the longest matching prefix wins. */
  prefixes: Record<string, number>;
}

/**
 * The waits used until the backend answers GET /timeouts, or when it never does (an older
 * backend): each a little longer than the backend gives the work itself, kept by hand.
 */
const FALLBACK_PREFIXES: Record<string, number> = {
  // The backend may first read the camera overrides from GitHub, given 30s, before reading the photo.
  "/exif": 90_000,
  // The backend gives resizing and R2 120s after receiving the photo.
  "/upload": 150_000,
  // A resized WEBP version of an uploaded photo, as an upload would put in R2.
  "/photos/versions/": 60_000,
  // Saving a photo may read its colors from R2, given 20s, its Small version, given 10s, then GitHub, given 30s.
  "/photos/github": 65_000,
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
  // Downloads the originals from R2 to read their EXIF, given 5 minutes; editing one gets 3 minutes.
  "/data/r2-exif": 310_000,
  // May download Small versions from R2 to read their perceptual hashes; the backend gives that 5 minutes.
  "/data/near-duplicates": 310_000,
  // Reads every photo file; the backend gives GitHub 60s.
  "/publish/": 65_000,
  // OpenStreetMap line look-ups; the backend gives the Overpass servers and their mirrors 100s.
  "/transit/": 105_000,
};

/** The waits in use: the fallback until setRelayTimeouts replaces them with the backend's. */
let current: RelayTimeouts = {
  // The backend gives GitHub 30s for most reads and saves.
  defaultMs: 35_000,
  prefixes: FALLBACK_PREFIXES,
};

/** Replaces the waits timeoutFor uses, such as with the ones the backend answers at start-up. */
export function setRelayTimeouts(timeouts: RelayTimeouts) {
  current = timeouts;
}

/** How long to wait for the backend to answer path, by the waits in use; its query is left out. */
export function timeoutFor(path: string): number {
  const { pathname } = new URL(path, "http://backend");
  const matches = Object.entries(current.prefixes)
    .filter(([prefix]) => pathname.startsWith(prefix))
    .toSorted(([a], [b]) => b.length - a.length);
  return matches[0]?.[1] ?? current.defaultMs;
}
