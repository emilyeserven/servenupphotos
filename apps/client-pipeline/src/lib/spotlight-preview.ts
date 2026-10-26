import type { PreviewPhoto } from "@/components/spotlight-preview";
import { type Focus, asFocus, resizedPhoto } from "@/lib/spotlight-focus";

/** A string field of a photo's data, trimmed, or undefined when it's empty or not a string. */
function text(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The photo's title as the portfolio shows it: the one written, or else its file name without the extension. */
function titleOf(data: Record<string, unknown>): string {
  return text(data, "title") ?? (text(data, "file") ?? "").replace(/\.[^.]*$/, "");
}

/**
 * Whether the portfolio's map can likely place the photo: it has a GPS position, written on the
 * Photo page or from its EXIF, or a place, which the map uses when that place has a position.
 */
function hasPosition(data: Record<string, unknown>): boolean {
  const gps = text(data, "customGpsPosition") ?? text(data, "gpsPosition");
  return gps !== undefined || (Array.isArray(data.places) && data.places.length > 0);
}

/** A photo's data as a spotlight preview shows it, with src as its image and the focus given. */
export function previewOf(
  data: Record<string, unknown>,
  src: string,
  focus: Focus | null,
): PreviewPhoto {
  return { src, title: titleOf(data), focus, onMap: hasPosition(data) };
}

/**
 * An ALLPHOTOS.json entry as a spotlight preview shows it, with its focus point; undefined when
 * it has no resized versions, which a spotlight zone can't show.
 */
export function combinedPreview(photo: Record<string, unknown>): PreviewPhoto | undefined {
  const src = resizedPhoto(photo);
  return src ? previewOf(photo, src, asFocus(photo.spotlightFocus)) : undefined;
}
