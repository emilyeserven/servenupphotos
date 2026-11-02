const STORAGE_KEY = "servenup-last-homepage-photo";

/** The id of the homepage photo this browser last showed, or nothing when none was saved or storage is blocked. */
function lastSeenPhotoId(): number | undefined {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY) ?? Number.NaN);
    return Number.isInteger(stored) ? stored : undefined;
  } catch {
    // Storage can be blocked (private mode, disabled cookies).
    return undefined;
  }
}

/** Saves the homepage photo showing now, so the next visit starts on the one after it. */
export function rememberHomepagePhoto({ id }: { id: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Ignore; the next visit starts on the first photo instead.
  }
}

/**
 * Where in the homepage's photos a visit starts: the photo after the one this browser last
 * showed, going back to the first after the last, or the first photo when the last one shown is
 * no longer among them.
 */
export function homepageStart(photos: { id: number }[]): number {
  const last = photos.findIndex((photo) => photo.id === lastSeenPhotoId());
  return last === -1 ? 0 : (last + 1) % photos.length;
}
