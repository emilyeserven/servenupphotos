import { type PhotoShape, shapeOf } from "@/lib/aspect-ratio";
import type { CombinedPhoto } from "@/lib/group-photos";

/** The shapes the album's Photos card can show alone, in the order its quick filter lists them. */
export const PHOTO_SHAPES: readonly PhotoShape[] = ["landscape", "portrait", "square"];

/** The photo's shape from the width and height in its JSON; none when it doesn't say. */
export function combinedPhotoShape(photo: CombinedPhoto): PhotoShape | undefined {
  const width = Number(photo.width);
  const height = Number(photo.height);
  if (!(width > 0) || !(height > 0)) return undefined;
  return shapeOf(width, height);
}

/** The photos of the shape chosen, or all of them when none is; undefined while they're read. */
export function photosOfShape<T extends CombinedPhoto[] | undefined>(
  photos: T,
  shape?: PhotoShape,
): T {
  if (!shape || !photos) return photos;
  return photos.filter((photo) => combinedPhotoShape(photo) === shape) as T;
}

/** How many of the photos have each shape; a photo without a size counts for none. */
export function shapeCounts(photos: CombinedPhoto[]): Record<PhotoShape, number> {
  const counts = { landscape: 0, portrait: 0, square: 0 };
  for (const photo of photos) {
    const shape = combinedPhotoShape(photo);
    if (shape) counts[shape] += 1;
  }
  return counts;
}
