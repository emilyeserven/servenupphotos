import { type ColorShare, HUE_BUCKETS, isShade } from "@/lib/photo-colors";

/** Where a pin sits on the color wheel, as fractions (0–1) of its width from the left and height from the top. */
export interface WheelPoint {
  x: number;
  y: number;
}

/**
 * How far out the most vivid photo sits, as a fraction of the wheel's width, so its pin stays
 * inside the wheel rather than half over its edge.
 */
const OUTER_RADIUS = 0.44;

/**
 * A photo's hue as an angle in degrees, clockwise from red at the top: the average of its hue
 * buckets around the wheel, each weighted by its share, so a photo half orange and half yellow
 * sits between them. Its shades are left out; 0 when it has no hues at all.
 */
export function hueAngle(palette: ColorShare[]): number {
  let x = 0;
  let y = 0;
  for (const { color, share } of palette) {
    if (isShade(color)) continue;
    const radians = (HUE_BUCKETS.indexOf(color) * 30 * Math.PI) / 180;
    x += share * Math.cos(radians);
    y += share * Math.sin(radians);
  }
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Where a photo sits on the wheel: around it by its hue, and out from the gray middle by how vivid
 * it is, the most vivid of the photos shown at the edge.
 */
export function wheelPoint(angle: number, vividness: number, mostVivid: number): WheelPoint {
  const radius = (Math.min(vividness, mostVivid) / mostVivid) * OUTER_RADIUS;
  const radians = (angle * Math.PI) / 180;
  return { x: 0.5 + radius * Math.sin(radians), y: 0.5 - radius * Math.cos(radians) };
}

/**
 * The wheel's background: the hue buckets' colors around it from red at the top, clockwise as the
 * pins are placed, fading to gray in the middle where the least vivid photos sit.
 */
export const WHEEL_BACKGROUND = [
  "radial-gradient(circle closest-side, hsl(0 0% 62%), hsl(0 0% 62% / 0))",
  `conic-gradient(${[...HUE_BUCKETS.map((_, i) => `hsl(${i * 30} 100% 50%)`), "hsl(360 100% 50%)"].join(", ")})`,
].join(", ");
