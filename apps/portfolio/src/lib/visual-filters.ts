import { type ColorFilters, filterByColors, parseColorFilters } from "@portfolio/lib/color-search";
import {
  matchesOrientation,
  ORIENTATION_KEY,
  ORIENTATIONS,
  type Orientation,
} from "@portfolio/lib/orientation";
import type { Photo } from "@portfolio/lib/photos";

/** The **Visuals** picker's filters: the color filters and the photo's orientation. */
export type VisualSearch = ColorFilters & { orientation?: Orientation };

/** Whether the value is one of the orientations, "horizontal", "vertical" or "square". */
function isOrientation(value: unknown): value is Orientation {
  return ORIENTATIONS.includes(value as Orientation);
}

/**
 * The Visuals filters in the URL, for the views without the Grid's camera filters (the Timeline and
 * the Map), which keep the orientation with them.
 */
export function parseVisualFilters(search: Record<string, unknown>): VisualSearch {
  const orientation = search[ORIENTATION_KEY];
  return { ...parseColorFilters(search), ...(isOrientation(orientation) ? { orientation } : {}) };
}

/** The photos the Visuals filters leave: of the orientation chosen, then the color filters'. */
export function filterByVisuals<T extends Photo>(list: T[], filters: VisualSearch): T[] {
  const turned = list.filter((photo) => matchesOrientation(photo, filters.orientation));
  return filterByColors(turned, filters);
}
