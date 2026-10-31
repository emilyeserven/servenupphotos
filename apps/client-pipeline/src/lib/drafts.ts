import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/api/settings";

/** The title saved in a photo's JSON, trimmed, or undefined without one. */
export function titleOf(data: unknown): string | undefined {
  const title = (data as { title?: unknown } | null | undefined)?.title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

/**
 * Whether a photo's JSON is a draft when untitled photos are kept as drafts: it has no title, so
 * Commit leaves it out of ALLPHOTOS.json and the portfolio doesn't show it. Undefined data (a file
 * that couldn't be read) isn't one.
 */
export function isDraft(data: unknown): boolean {
  return data !== undefined && data !== null && titleOf(data) === undefined;
}

/**
 * Whether a photo's JSON is marked as not chosen in a compare group: its `unselected` is an object.
 * Its images in R2 may be gone, so Commit always leaves it out of ALLPHOTOS.json.
 */
export function isUnselected(data: unknown): boolean {
  const unselected = (data as { unselected?: unknown } | null | undefined)?.unselected;
  return typeof unselected === "object" && unselected !== null && !Array.isArray(unselected);
}

/**
 * Whether Commit leaves a photo out of ALLPHOTOS.json: it's unselected, or it's a draft and untitled
 * photos aren't included.
 */
export function leftOffPortfolio(data: unknown, includeUntitled = false): boolean {
  return isUnselected(data) || (!includeUntitled && isDraft(data));
}

/**
 * Whether untitled photos are kept as drafts, as Settings say (on unless "Keep untitled photos as
 * drafts" is turned off). True until the settings are read, since that's the default.
 */
export function useUntitledDrafts(): boolean {
  const settings = useQuery(settingsQuery);
  return !settings.data?.github.includeUntitled;
}
