import { DEFAULT_COLOR_DISPLAY } from "@/lib/color-display";
import { type KeepInside, spreadPins, type WheelPoint } from "@/lib/color-wheel";
import type { ViewportSize } from "@/lib/use-wheel-zoom";
import { clusterPlaces, type WheelMarker } from "@/lib/wheel-clusters";

/** The gap, in pixels, kept between pins when they're spread apart. */
export const PIN_GAP_PX = 3;

/** How close, in pin widths, photos' places are for them to be clustered together at the default Grouping. */
const CLUSTER_SPAN = 1.5;

/**
 * How close, in pin widths, photos' places are for them to be clustered together at a Grouping
 * from the display options: 1.5 at the default, scaled with it, so less groups fewer.
 */
export function clusterSpan(grouping: number): number {
  return (CLUSTER_SPAN * grouping) / DEFAULT_COLOR_DISPLAY.grouping;
}

/**
 * The photos' places (fractions of the wheel's or chart's width and height) as markers on a
 * canvas of size pixels, with pins pinPx wide: clustered where they're within span pin widths of
 * each other, unless span is 0, as at the furthest zoom so every photo can be reached, then spread apart
 * so the pins don't overlap, kept where keep keeps them. The markers' places are fractions again.
 */
export function pinMarkers(
  places: WheelPoint[],
  canvas: ViewportSize,
  pinPx: number,
  span: number,
  keep: KeepInside,
): WheelMarker[] {
  const { width, height } = canvas;
  if (width <= 0) return places.map((at, i) => ({ members: [i], at }));
  const pixels = places.map((p) => ({ x: p.x * width, y: p.y * height }));
  const markers = clusterPlaces(pixels, pinPx * span);
  const spread = spreadPins(
    markers.map((marker) => marker.at),
    pinPx + PIN_GAP_PX,
    keep,
  );
  return markers.map((marker, i) => ({
    ...marker,
    at: { x: spread[i]!.x / width, y: spread[i]!.y / height },
  }));
}
