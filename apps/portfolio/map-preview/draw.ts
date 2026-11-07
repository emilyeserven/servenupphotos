/**
 * Drawing on the preview image's pixels: pasting tiles, and filling smooth shapes for the pins and
 * their counts. Each shape is a distance function (how far a point is outside its edge), so its
 * edges blend into what's under them instead of looking jagged.
 *
 * > **Frontend analogy:** the same idea as CSS `border-radius` and anti-aliasing, done by hand per
 * > pixel because Node has no canvas, and this keeps the build free of native packages.
 */
import type { Rgba } from "./png.ts";

/** The image being drawn: RGB, three bytes per pixel, row by row. */
export interface Canvas {
  width: number;
  height: number;
  rgb: Uint8Array;
}

/** A color as red, green and blue from 0 to 255. */
export type Color = [number, number, number];

/** How far a point is outside a shape's edge, in pixels: negative inside. */
type Distance = (x: number, y: number) => number;

/** A box around a shape, in pixels: its left, top, right and bottom. */
type Box = [number, number, number, number];

/** A blank canvas of one color. */
export function canvasOf(width: number, height: number, color: Color): Canvas {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set(color, i);
  return { width, height, rgb };
}

/** Blends one pixel toward the color by alpha, from 0 (unchanged) to 1 (the color). */
function blend(canvas: Canvas, at: number, color: Color, alpha: number) {
  for (let c = 0; c < 3; c++) {
    canvas.rgb[at + c] = Math.round(
      canvas.rgb[at + c]! + (color[c]! - canvas.rgb[at + c]!) * alpha,
    );
  }
}

/** The part of a range that's inside 0 to max, as whole pixels. */
function clip(from: number, to: number, max: number): [number, number] {
  return [Math.max(0, Math.floor(from)), Math.min(max, Math.ceil(to))];
}

/** Copies one RGBA pixel onto an RGB one, blending it when it's partly transparent. */
function pastePixel(canvas: Canvas, at: number, data: Uint8Array, from: number) {
  const alpha = data[from + 3]!;
  if (alpha === 255) {
    canvas.rgb[at] = data[from]!;
    canvas.rgb[at + 1] = data[from + 1]!;
    canvas.rgb[at + 2] = data[from + 2]!;
  } else if (alpha > 0)
    blend(canvas, at, [data[from]!, data[from + 1]!, data[from + 2]!], alpha / 255);
}

/**
 * Pastes an RGBA image with its top left corner at (left, top), whole pixels, blending its
 * transparent parts.
 */
export function paste(canvas: Canvas, image: Rgba, left: number, top: number) {
  const [x0, x1] = clip(left, left + image.width, canvas.width);
  const [y0, y1] = clip(top, top + image.height, canvas.height);
  for (let y = y0; y < y1; y++) {
    const from = ((y - top) * image.width - left) * 4;
    for (let x = x0; x < x1; x++)
      pastePixel(canvas, (y * canvas.width + x) * 3, image.data, from + x * 4);
  }
}

/**
 * Fills a shape with a color. Feather is how many pixels its edge fades over: 1 for a crisp edge,
 * more for a soft shadow.
 */
function fill(
  canvas: Canvas,
  box: Box,
  distance: Distance,
  color: Color,
  opacity = 1,
  feather = 1,
) {
  const [x0, x1] = clip(box[0] - feather, box[2] + feather, canvas.width);
  const [y0, y1] = clip(box[1] - feather, box[3] + feather, canvas.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const cover = Math.min(1, Math.max(0, 0.5 - distance(x + 0.5, y + 0.5) / feather));
      if (cover > 0) blend(canvas, (y * canvas.width + x) * 3, color, cover * opacity);
    }
  }
}

/** Optional softness and see-through-ness for a filled shape. */
export interface FillStyle {
  opacity?: number;
  feather?: number;
}

/** Fills a circle. */
export function fillCircle(
  canvas: Canvas,
  cx: number,
  cy: number,
  r: number,
  color: Color,
  style: FillStyle = {},
) {
  const distance: Distance = (x, y) => Math.hypot(x - cx, y - cy) - r;
  fill(canvas, [cx - r, cy - r, cx + r, cy + r], distance, color, style.opacity, style.feather);
}

/** Fills a square centered on (cx, cy), half as wide as half, with rounded corners of radius. */
export function fillRoundedSquare(
  canvas: Canvas,
  [cx, cy]: [number, number],
  half: number,
  radius: number,
  color: Color,
  style: FillStyle = {},
) {
  const inner = half - radius;
  const distance: Distance = (x, y) => {
    const qx = Math.abs(x - cx) - inner;
    const qy = Math.abs(y - cy) - inner;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  };
  fill(
    canvas,
    [cx - half, cy - half, cx + half, cy + half],
    distance,
    color,
    style.opacity,
    style.feather,
  );
}

/** How far (x, y) is from the line segment from a to b. */
function segmentDistance(x: number, y: number, [ax, ay]: number[], [bx, by]: number[]): number {
  const dx = bx! - ax!;
  const dy = by! - ay!;
  const t = Math.max(0, Math.min(1, ((x - ax!) * dx + (y - ay!) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax! - t * dx, y - ay! - t * dy);
}

/** Draws a line through the points, width pixels wide with round ends and joins. */
export function strokeLine(
  canvas: Canvas,
  points: [number, number][],
  width: number,
  color: Color,
) {
  const half = width / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const box: Box = [
      Math.min(a[0], b[0]) - half,
      Math.min(a[1], b[1]) - half,
      Math.max(a[0], b[0]) + half,
      Math.max(a[1], b[1]) + half,
    ];
    fill(canvas, box, (x, y) => segmentDistance(x, y, a, b) - half, color);
  }
}

/** A hex color such as "#514d48" as RGB, or the fallback when it isn't one. */
export function hexColor(hex: string | null, fallback: Color): Color {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return match ? ([1, 2, 3].map((i) => parseInt(match[i]!, 16)) as Color) : fallback;
}
