import type { SocialPhoto } from "@/api/publish";
import type { FieldChange, LocalEdit } from "@/stores/local-edits";

/** The photo JSON field that holds the point to keep in view where a spotlight zone crops it. */
export const SPOTLIGHT_FOCUS = "spotlightFocus";

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

/** The value the photo's focus has: its local edit's when it has one, or else its file's. */
function focusValue(edit: LocalEdit | undefined, photo: SocialPhoto): unknown {
  if (edit && SPOTLIGHT_FOCUS in edit.fields) return edit.fields[SPOTLIGHT_FOCUS];
  return photo.data[SPOTLIGHT_FOCUS];
}

/** The photo's focus with its local edit applied, or null for its middle. */
export function focusOf(edits: Record<string, LocalEdit>, photo: SocialPhoto): Focus | null {
  const value = focusValue(edits[photo.path], photo);
  return isFocus(value) ? value : null;
}

/** The local edit that sets the photo's focus, or puts it back in the middle with null. */
export function focusChange(photo: SocialPhoto, focus: Focus | null): FieldChange {
  return { path: photo.path, before: photo.data, value: focus };
}

/** The focus as CSS's object-position, the middle without one. */
export function objectPosition(focus: Focus | null): string {
  return focus ? `${focus.x}% ${focus.y}%` : "50% 50%";
}

/** A percentage from 0 to 100, rounded to a whole one. */
function percent(offset: number, size: number): number {
  return Math.min(100, Math.max(0, Math.round((offset / size) * 100)));
}

/** The point clicked in an element, as a focus. */
export function clickedFocus(clientX: number, clientY: number, box: DOMRect): Focus {
  return { x: percent(clientX - box.left, box.width), y: percent(clientY - box.top, box.height) };
}

/** The photo's Medium version, or a smaller one, or else its Square Thumbnail. */
export function wholePhoto(photo: SocialPhoto): string | null {
  const images = isObject(photo.data.images) ? photo.data.images : {};
  const found = [images.medium, images.small, images.xsmall].find((url) => typeof url === "string");
  return (found as string | undefined) ?? photo.image;
}
