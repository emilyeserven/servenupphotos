import type { Photo } from "@portfolio/lib/photos";

/** The orientations the **Orientation** filter picks between, as the URL names them. */
export const ORIENTATIONS = ["horizontal", "vertical", "square"] as const;

export type Orientation = (typeof ORIENTATIONS)[number];

/** The filter for the photos' orientation, "horizontal", "vertical" or "square". */
export const ORIENTATION_KEY = "orientation";

/**
 * Whether the photo is wider than it's tall ("horizontal"), taller than it's wide ("vertical"), or
 * as wide as it's tall ("square"). One without a size has none, as it hasn't been uploaded yet.
 */
function orientationOf({ image }: Photo): Orientation | undefined {
  if (!image) return undefined;
  if (image.width === image.height) return "square";
  return image.width > image.height ? "horizontal" : "vertical";
}

/** Whether the photo has the orientation chosen, or none is. */
export function matchesOrientation(photo: Photo, orientation: string | undefined): boolean {
  return orientation === undefined || orientationOf(photo) === orientation;
}

/** How many of the photos have each orientation. */
export function orientationCounts(list: Photo[]): Record<Orientation, number> {
  const counts = { horizontal: 0, vertical: 0, square: 0 };
  for (const photo of list) {
    const orientation = orientationOf(photo);
    if (orientation) counts[orientation] += 1;
  }
  return counts;
}
