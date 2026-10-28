import type { SocialPhoto } from "@/api/publish";
import type { FieldChange, LocalEdit } from "@/stores/local-edits";

/** The photo JSON field that holds the point to keep in view where a spotlight zone crops it. */
export const SPOTLIGHT_FOCUS = "spotlightFocus";

/** The photo JSON field that holds where on the screen a spotlight zone puts the focus point. */
export const SPOTLIGHT_PLACEMENT = "spotlightPlacement";

/** A point of a photo, as percentages of its width and height from its top left corner. */
export interface Focus {
  x: number;
  y: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFocus(value: unknown): value is Focus {
  return isObject(value) && typeof value.x === "number" && typeof value.y === "number";
}

/** A spotlightFocus value as a focus, or null for the photo's middle when it isn't one. */
export function asFocus(value: unknown): Focus | null {
  return isFocus(value) ? value : null;
}

/** The value the photo's field has: its local edit's when it has one, or else its file's. */
function fieldValue(edit: LocalEdit | undefined, photo: SocialPhoto, field: string): unknown {
  if (edit && field in edit.fields) return edit.fields[field];
  return photo.data[field];
}

/**
 * The photo's focus, or with SPOTLIGHT_PLACEMENT its placement, with its local edit applied; null
 * for the middle.
 */
export function focusOf(
  edits: Record<string, LocalEdit>,
  photo: SocialPhoto,
  field = SPOTLIGHT_FOCUS,
): Focus | null {
  return asFocus(fieldValue(edits[photo.path], photo, field));
}

/** The local edit that sets the photo's focus or placement, or puts it back in the middle with null. */
export function focusChange(photo: SocialPhoto, focus: Focus | null): FieldChange {
  return { path: photo.path, before: photo.data, value: focus };
}

/** A width and a height in pixels. */
export interface Size {
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
 * (its middle without one) at the placement on the screen (its middle without one), or as near as
 * the photo's edges allow. The portfolio's homepage crops its photos the same way.
 */
export function objectPosition(
  focus: Focus | null,
  placement: Focus | null,
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

/** A percentage from 0 to 100, rounded to a whole one. */
function percent(offset: number, size: number): number {
  return Math.min(100, Math.max(0, Math.round((offset / size) * 100)));
}

/** The point clicked in an element, as a focus. */
export function clickedFocus(clientX: number, clientY: number, box: DOMRect): Focus {
  return { x: percent(clientX - box.left, box.width), y: percent(clientY - box.top, box.height) };
}

/** The Medium version in a photo's data, or a smaller one; undefined when it has none. */
export function resizedPhoto(data: Record<string, unknown>): string | undefined {
  const images = isObject(data.images) ? data.images : {};
  const found = [images.medium, images.small, images.xsmall].find((url) => typeof url === "string");
  return found as string | undefined;
}

/** The photo's Medium version, or a smaller one, or else its Square Thumbnail. */
export function wholePhoto(photo: SocialPhoto): string | null {
  return resizedPhoto(photo.data) ?? photo.image;
}
