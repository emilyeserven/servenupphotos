import { parseImage } from "@portfolio/lib/photo-image";

/** A photo place's size on the screen, in CSS pixels. */
export interface BoxSize {
  width: number;
  height: number;
}

/**
 * The photo's resized versions for a place of box's size on a Photo Book page, for an `<img>`'s
 * `srcSet` and `sizes`: `sizes` is how wide the photo is drawn once cropped to cover the place, so
 * the browser picks the smallest version at least that wide times the screen's pixel ratio. Empty
 * before the place is measured, or for no photo data or one whose JSON has no size or versions.
 */
export function slotSources(data: unknown, box: BoxSize): { srcSet?: string; sizes?: string } {
  if (box.width <= 0 || box.height <= 0 || typeof data !== "object" || data === null) return {};
  const { width, height, images } = data as { width?: unknown; height?: unknown; images?: unknown };
  if (typeof width !== "number" || typeof height !== "number") return {};
  if (typeof images !== "object" || images === null) return {};
  const image = parseImage({ width, height, images });
  if (!image) return {};
  const scale = Math.max(box.width / width, box.height / height);
  return { srcSet: image.srcSet, sizes: `${Math.ceil(width * scale)}px` };
}
