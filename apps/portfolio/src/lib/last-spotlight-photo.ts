/**
 * Where this browser keeps the last photo a spotlight zone showed, by the zone's ID, such as
 * `servenup-last-homepage-photo` for the homepage.
 */
function storageKey(zone: string): string {
  return `servenup-last-${zone}-photo`;
}

/** The id of the photo the zone last showed in this browser, or nothing when none was saved or storage is blocked. */
function lastSeenPhotoId(zone: string): number | undefined {
  try {
    const stored = Number(localStorage.getItem(storageKey(zone)) ?? Number.NaN);
    return Number.isInteger(stored) ? stored : undefined;
  } catch {
    // Storage can be blocked (private mode, disabled cookies).
    return undefined;
  }
}

/** Saves the photo the zone shows now, so the next visit starts on the one after it. */
export function rememberSpotlightPhoto(zone: string, { id }: { id: number }) {
  try {
    localStorage.setItem(storageKey(zone), String(id));
  } catch {
    // Ignore; the next visit starts on the first photo instead.
  }
}

/**
 * Where in the zone's photos a visit starts: the photo after the one this browser last showed in
 * it, going back to the first after the last, or the first photo when the last one shown is no
 * longer among them.
 */
export function spotlightStart(zone: string, photos: { id: number }[]): number {
  const last = photos.findIndex((photo) => photo.id === lastSeenPhotoId(zone));
  return last === -1 ? 0 : (last + 1) % photos.length;
}
