import type { SpotlightFocus } from "@/lib/photos";

/** A width and a height in pixels. */
interface Size {
  width: number;
  height: number;
}

/**
 * Where along one side, as a percent for `object-position`, an image `drawn` long must sit in a
 * box `box` long so its point at `focus` percent lands at `place` percent of the box, as close as
 * it can without leaving a gap at either end.
 */
function sidePercent(focus: number, place: number, drawn: number, box: number): number {
  if (drawn - box < 0.5) return 50;
  const at = ((place / 100) * box - (focus / 100) * drawn) / (box - drawn);
  return Math.round(Math.min(1, Math.max(0, at)) * 1000) / 10;
}

/**
 * The CSS `object-position` that crops an image of `image`'s size to fill `box` with its focus
 * point (its middle without one) where the placement says on the screen (its middle without one),
 * or as near as the photo's edges allow.
 */
export function objectPosition(
  focus: SpotlightFocus | null,
  placement: SpotlightFocus | null,
  image: Size,
  box: Size,
): string {
  const at = focus ?? { x: 50, y: 50 };
  const place = placement ?? { x: 50, y: 50 };
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const x = sidePercent(at.x, place.x, image.width * scale, box.width);
  const y = sidePercent(at.y, place.y, image.height * scale, box.height);
  return `${x}% ${y}%`;
}
