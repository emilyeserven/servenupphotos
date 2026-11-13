/** Where this browser keeps the Settings page's **Show Lower Tier photos** choice. */
const STORAGE_KEY = "servenup-show-lower-tier";

/**
 * Whether this browser chose to show Lower Tier photos on the Settings page; false until it does,
 * and where storage can't be read (private mode, or the build running in Node).
 */
export function readShowLowerTier(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Remembers the **Show Lower Tier photos** choice in this browser. */
export function saveShowLowerTier(show: boolean): void {
  try {
    if (show) localStorage.setItem(STORAGE_KEY, "true");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the choice then lasts only until the page reloads.
  }
}

/**
 * The photos the portfolio shows: every one when `show` is on, or else all but the ones marked
 * Lower Tier in the pipeline. `show` defaults to this browser's choice on the Settings page.
 */
export function shownTiers<T extends { lowerTier: boolean }>(
  photos: T[],
  show: boolean = readShowLowerTier(),
): T[] {
  return show ? photos : photos.filter((photo) => !photo.lowerTier);
}
