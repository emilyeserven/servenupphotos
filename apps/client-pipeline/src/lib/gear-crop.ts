import type { CSSProperties } from "react";
import type { GearBox, GearCrop } from "@portfolio/lib/gear-pictures";

/** A gear picture's crop's size in pixels, as the backend makes it: 200px tall and 4:3. */
const GEAR_CROP_SIZE = { width: 267, height: 200 };

/** The crop's width over its height. */
const ASPECT = GEAR_CROP_SIZE.width / GEAR_CROP_SIZE.height;

/**
 * The crop that shows the whole of a `width` by `height` picture, centered, with white around it,
 * or the `fill` given.
 */
export function wholeCrop(
  width: number,
  height: number,
  fill: GearCrop["fill"] = "white",
): GearCrop {
  if (width / height > ASPECT) {
    const h = width / ASPECT / height;
    return { x: 0, y: (1 - h) / 2, width: 1, height: h, fill };
  }
  const w = (height * ASPECT) / width;
  return { x: (1 - w) / 2, y: 0, width: w, height: 1, fill };
}

/** The crop made `factor` times bigger (zoomed out) or smaller (zoomed in), about its middle. */
function scaleCrop(crop: GearCrop, factor: number): GearCrop {
  const width = crop.width * factor;
  const height = crop.height * factor;
  return {
    ...crop,
    x: crop.x + (crop.width - width) / 2,
    y: crop.y + (crop.height - height) / 2,
    width,
    height,
  };
}

/** The crop moved so the picture follows a drag of `dx` and `dy`, as fractions of the frame. */
export function moveCrop(crop: GearCrop, dx: number, dy: number): GearCrop {
  return { ...crop, x: crop.x - dx * crop.width, y: crop.y - dy * crop.height };
}

/** How far the crop is zoomed in, as a power of two: 0 when the picture's height fills the frame. */
export function zoomOf(crop: GearCrop): number {
  return -Math.log2(crop.height);
}

/** The crop zoomed to `zoom`, a power of two as `zoomOf` gives, about its middle. */
export function zoomCrop(crop: GearCrop, zoom: number): GearCrop {
  return scaleCrop(crop, 2 ** -zoom / crop.height);
}

/** Where an original goes in a frame, absolutely placed, so the frame shows just its crop. */
export function cropStyle(crop: GearCrop): CSSProperties {
  return {
    position: "absolute",
    maxWidth: "none",
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
  };
}

/** Whether two crops are the same, or both missing. */
export function sameCrop(a?: GearCrop, b?: GearCrop): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** How far in from each side of the crop frame its limit lines are, as percentages of the frame. */
export interface CropLimits {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The space inside the limit lines, as fractions of the frame. */
function insideLimits(limits: CropLimits): GearBox {
  const x = limits.left / 100;
  const y = limits.top / 100;
  return { x, y, width: 1 - x - limits.right / 100, height: 1 - y - limits.bottom / 100 };
}

/**
 * The crop that normalizes a `width` by `height` picture: its `subject` (the gear, found when it
 * was uploaded) as big as it fits inside the limit lines and centered between them, whatever the
 * picture's size or shape, with `fill` around it.
 */
export function fitCrop(
  subject: GearBox,
  [width, height]: [number, number],
  limits: CropLimits,
  fill: GearCrop["fill"] = "white",
): GearCrop {
  const inside = insideLimits(limits);
  const ch = Math.max(
    subject.height / inside.height,
    ((subject.width / inside.width) * width) / (height * ASPECT),
  );
  const cw = (ch * height * ASPECT) / width;
  const middleX = inside.x + inside.width / 2;
  const middleY = inside.y + inside.height / 2;
  return {
    x: subject.x + subject.width / 2 - middleX * cw,
    y: subject.y + subject.height / 2 - middleY * ch,
    width: cw,
    height: ch,
    fill,
  };
}
