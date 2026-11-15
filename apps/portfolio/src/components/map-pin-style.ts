import type { CSSProperties, MouseEvent } from "react";
import { type MapDisplay, PIN_PIXELS } from "@/lib/map-display";

/** Clicks on markers and in popups would otherwise reach the map too, which closes the popups. */
export function stopAtMarker(event: MouseEvent) {
  event.stopPropagation();
}

/** A marker's width and height, in the size the display options pick. */
export function pinStyle(display: MapDisplay): CSSProperties {
  const size = PIN_PIXELS[display.pinSize];
  return { width: size, height: size };
}

/** A marker's white edge and shadow, growing a little under the pointer or when focused. */
export const MARKER_RING =
  "outline-none ring-2 ring-white shadow-md shadow-black/30 transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:ring-sky-500";
