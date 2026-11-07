import type { SocialPhoto } from "@/api/publish";
import type { FieldChange, LocalEdit } from "@/stores/local-edits";

/**
 * The photo JSON field that holds its focus point and placement for each spotlight zone, by zone
 * ID, such as `{ "grid-header": { "focus": { "x": 30, "y": 70 }, "placement": null } }`.
 */
export const SPOTLIGHT_ZONE_FOCUS = "spotlightZoneFocus";

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

/** A saved focus point or placement as a focus, or null for the photo's middle when it isn't one. */
function asFocus(value: unknown): Focus | null {
  return isFocus(value) ? value : null;
}

/** A photo's focus point and placement in one spotlight zone; null for the middle. */
export interface ZoneFocus {
  focus: Focus | null;
  placement: Focus | null;
}

/** The photo's focus points by zone, as its data holds them; empty when it has none. */
function zoneFocusMap(data: Record<string, unknown>): Record<string, unknown> {
  const value = data[SPOTLIGHT_ZONE_FOCUS];
  return isObject(value) ? value : {};
}

/**
 * The photo's focus point and placement in the zone: its own for the zone, or else the
 * `spotlightFocus` and `spotlightPlacement` it had before each zone had its own.
 */
export function zoneFocusOf(data: Record<string, unknown>, zone: string): ZoneFocus {
  const entry = zoneFocusMap(data)[zone];
  if (isObject(entry)) return { focus: asFocus(entry.focus), placement: asFocus(entry.placement) };
  return { focus: asFocus(data.spotlightFocus), placement: asFocus(data.spotlightPlacement) };
}

/** The photo's data with its local edit applied, as Commit will save it. */
export function editedData(
  edits: Record<string, LocalEdit>,
  photo: SocialPhoto,
): Record<string, unknown> {
  const edit = edits[photo.path];
  return edit ? { ...photo.data, ...edit.fields } : photo.data;
}

/**
 * The local edit that gives the photo, whose data with its local edit is `data`, the focus point
 * and placement `next` in the zone, keeping its other zones'.
 */
export function zoneFocusChange(
  photo: SocialPhoto,
  data: Record<string, unknown>,
  zone: string,
  next: ZoneFocus,
): FieldChange {
  return { path: photo.path, before: photo.data, value: { ...zoneFocusMap(data), [zone]: next } };
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
function resizedPhoto(data: Record<string, unknown>): string | undefined {
  const images = isObject(data.images) ? data.images : {};
  const found = [images.medium, images.small, images.xsmall].find((url) => typeof url === "string");
  return found as string | undefined;
}

/** The photo's Medium version, or a smaller one, or else its Square Thumbnail. */
export function wholePhoto(photo: SocialPhoto): string | null {
  return resizedPhoto(photo.data) ?? photo.image;
}
