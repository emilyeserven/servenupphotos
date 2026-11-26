import { parseImage, type PhotoImages } from "@portfolio/lib/photo-image";

/** A photo place's size on the screen, in CSS pixels. */
export interface BoxSize {
  width: number;
  height: number;
}

/** The fields of a photo's JSON entry a place's photo is drawn from. */
interface SlotPhoto {
  /** The photo's size in pixels. */
  width: number;
  height: number;
  /** Its resized versions, and its original JPEG in R2 as `full`. */
  images: PhotoImages & { full?: unknown };
}

/** The photo's JSON entry as a SlotPhoto, or null for one without a size or images. */
function slotPhoto(data: unknown): SlotPhoto | null {
  if (typeof data !== "object" || data === null) return null;
  const { width, height, images } = data as { width?: unknown; height?: unknown; images?: unknown };
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (typeof images !== "object" || images === null) return null;
  return { width, height, images: images as SlotPhoto["images"] };
}

/** The photo's original JPEG in R2 (`images.full`) as a srcSet of its own width, or undefined when it has none. */
function originalSrcSet(photo: SlotPhoto): string | undefined {
  const { full } = photo.images;
  return typeof full === "string" && full ? `${full} ${photo.width}w` : undefined;
}

/**
 * The photo's resized versions for a place of box's size on a Photo Book page, for an `<img>`'s
 * `srcSet` and `sizes`: `sizes` is how wide the photo is drawn once cropped to cover the place, so
 * the browser picks the smallest version at least that wide times the screen's pixel ratio. With
 * `original`, for **Save as PDF**, the photo's original JPEG is its only choice, so the printed book
 * has every photo at full resolution, never a resized WEBP; a photo without one keeps its versions. Empty before the place is measured, or for
 * no photo data or one whose JSON has no size or versions.
 */
export function slotSources(
  data: unknown,
  box: BoxSize,
  original = false,
): { srcSet?: string; sizes?: string } {
  const photo = slotPhoto(data);
  if (box.width <= 0 || box.height <= 0 || !photo) return {};
  const image = parseImage(photo);
  if (!image) return {};
  const scale = Math.max(box.width / photo.width, box.height / photo.height);
  const srcSet = (original && originalSrcSet(photo)) || image.srcSet;
  return { srcSet, sizes: `${Math.ceil(photo.width * scale)}px` };
}
