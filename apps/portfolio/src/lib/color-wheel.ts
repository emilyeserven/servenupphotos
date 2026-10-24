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
 * A photo's hue as an angle in degrees, clockwise from red at the top: its biggest hue bucket's
 * angle, pulled toward its second biggest hue bucket by that bucket's share of the two, along the
 * shorter way round. A photo with as much orange as yellow sits halfway between them; one with
 * only orange sits on orange. Shades are left out; 0 when it has no hues at all.
 */
export function hueAngle(palette: ColorShare[]): number {
  const [first, second] = palette.filter((c) => !isShade(c.color));
  if (!first) return 0;
  const from = bucketAngle(first);
  if (!second) return from;
  const pull = second.share / (first.share + second.share);
  return (from + shortestTurn(from, bucketAngle(second)) * pull + 360) % 360;
}

/** A hue bucket's angle, every 30° clockwise from red at the top. */
function bucketAngle({ color }: ColorShare): number {
  return HUE_BUCKETS.indexOf(color as (typeof HUE_BUCKETS)[number]) * 30;
}

/** The turn in degrees from one angle to another the shorter way round, from -180 to 180. */
function shortestTurn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
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

/** How many rounds spreadPins pushes overlapping pins apart. */
const SPREAD_ROUNDS = 60;

/** Moves a point of a pin size wide back inside the area pins are kept in. */
export type KeepInside = (p: WheelPoint, size: number) => void;

/**
 * The points moved apart so pins of size (in pixels, as the points are) overlap as little as they
 * can, each pair that's too close pushed apart along the line between them, a little each round,
 * and kept where keep keeps them, such as inside the wheel. Pins only move as far as they need
 * to, so each stays near its place.
 */
export function spreadPins(points: WheelPoint[], size: number, keep: KeepInside): WheelPoint[] {
  const spread = points.map((p, i) => ({
    x: p.x + jitter(i, size),
    y: p.y + jitter(i + 0.5, size),
  }));
  pushApartRounds(spread, size, keep);
  // Again at the end, for pins that never needed spreading but sit too near the edge.
  for (const p of spread) keep(p, size);
  return spread;
}

/** Pushes the points apart, keeping them where keep keeps them, until none overlap or the rounds run out. */
function pushApartRounds(points: WheelPoint[], size: number, keep: KeepInside) {
  for (let round = 0; round < SPREAD_ROUNDS; round++) {
    if (!pushApart(points, size)) return;
    for (const p of points) keep(p, size);
  }
}

/**
 * A tiny nudge that differs for each pin, so pins at the same spot, which have no line between
 * them to be pushed apart along, still separate.
 */
function jitter(seed: number, size: number): number {
  return Math.sin(seed * 12.9898) * size * 0.01;
}

/** Pushes every pair of points closer than size apart, each half the overlap; false when none were. */
function pushApart(points: WheelPoint[], size: number): boolean {
  let moved = false;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      moved = separate(points[i]!, points[j]!, size) || moved;
    }
  }
  return moved;
}

/** Moves a and b apart along the line between them until they're size apart, if they're closer. */
function separate(a: WheelPoint, b: WheelPoint, size: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1e-6;
  if (distance >= size) return false;
  const push = (size - distance) / 2 / distance;
  a.x -= dx * push;
  a.y -= dy * push;
  b.x += dx * push;
  b.y += dy * push;
  return true;
}

/**
 * Brings a point back inside a wheel stretched to fill width by height pixels, an oval when
 * they differ, so its pin doesn't hang over the edge.
 */
export function keepInWheel(width: number, height: number): KeepInside {
  return (p, size) => {
    const rx = 0.48 * width - size / 2;
    const ry = 0.48 * height - size / 2;
    const dx = p.x - width / 2;
    const dy = p.y - height / 2;
    const out = Math.hypot(dx / rx, dy / ry);
    if (out <= 1) return;
    p.x = width / 2 + dx / out;
    p.y = height / 2 + dy / out;
  };
}
