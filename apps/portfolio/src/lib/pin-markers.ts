import { type KeepInside, spreadPins, type WheelPoint } from "@/lib/color-wheel";
import type { ViewportSize } from "@/lib/use-wheel-zoom";
import { clusterPlaces, type WheelMarker } from "@/lib/wheel-clusters";

/** The gap, in pixels, kept between pins when they're spread apart. */
export const PIN_GAP_PX = 3;

/** How close, in pin widths, photos' places are for them to be clustered together. */
const CLUSTER_SPAN = 1.5;

/**
 * The photos' places (fractions of the wheel's or chart's width and height) as markers on a
 * canvas of size pixels, with pins pinPx wide: clustered where they crowd together, unless
 * clustered is false, as at the furthest zoom so every photo can be reached, then spread apart
 * so the pins don't overlap, kept where keep keeps them. The markers' places are fractions again.
 */
export function pinMarkers(
  places: WheelPoint[],
  canvas: ViewportSize,
  pinPx: number,
  clustered: boolean,
  keep: KeepInside,
): WheelMarker[] {
  const { width, height } = canvas;
  if (width <= 0) return places.map((at, i) => ({ members: [i], at }));
  const pixels = places.map((p) => ({ x: p.x * width, y: p.y * height }));
  const markers = clusterPlaces(pixels, clustered ? pinPx * CLUSTER_SPAN : 0);
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
