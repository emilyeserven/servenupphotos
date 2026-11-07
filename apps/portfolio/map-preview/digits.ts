/**
 * The numbers on group pins, drawn as strokes, so the build needs no fonts. Each digit is lines
 * through points in a box 1 wide and 1 tall, from its top left.
 */
import { type Canvas, type Color, strokeLine } from "./draw.ts";

type Line = [number, number][];

/** Points along part of an ellipse, by angle in degrees: 0° is right and 90° is down. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Line {
  const steps = Math.max(4, Math.ceil(Math.abs(to - from) / 15));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

/** A digit turned upside down, as a 9 is a 6. */
function turned(lines: Line[]): Line[] {
  return lines.map((line) => line.map(([x, y]) => [1 - x, 1 - y]));
}

const SIX: Line[] = [arc(0.5, 0.68, 0.45, 0.32, 0, 360), arc(1.05, 0.68, 1, 0.68, 180, 252)];

const GLYPHS: Record<string, Line[]> = {
  "0": [arc(0.5, 0.5, 0.45, 0.5, 0, 360)],
  "1": [
    [
      [0.2, 0.22],
      [0.58, 0],
      [0.58, 1],
    ],
  ],
  "2": [[...arc(0.5, 0.28, 0.43, 0.28, 195, 380), [0.05, 1], [0.97, 1]]],
  "3": [arc(0.5, 0.25, 0.4, 0.25, 205, 450), arc(0.5, 0.73, 0.46, 0.27, 270, 515)],
  "4": [
    [
      [0.72, 1],
      [0.72, 0],
      [0.02, 0.7],
      [0.98, 0.7],
    ],
  ],
  "5": [[[0.88, 0], [0.2, 0], [0.12, 0.45], ...arc(0.5, 0.68, 0.45, 0.32, 220, 495)]],
  "6": SIX,
  "7": [
    [
      [0.02, 0],
      [0.98, 0],
      [0.35, 1],
    ],
  ],
  "8": [arc(0.5, 0.25, 0.38, 0.25, 0, 360), arc(0.5, 0.72, 0.46, 0.28, 0, 360)],
  "9": turned(SIX),
};

/** How wide a digit is for its height, and the gap after it. */
const WIDTH = 0.6;
const GAP = 0.22;

/**
 * Draws a whole number centered on (cx, cy), at most height pixels tall and width pixels wide, with
 * strokes a seventh of its height.
 */
export function drawNumber(
  canvas: Canvas,
  text: string,
  [cx, cy]: [number, number],
  [width, height]: [number, number],
  color: Color,
) {
  const em = Math.min(height, width / (text.length * (WIDTH + GAP) - GAP));
  const left = cx - ((text.length * (WIDTH + GAP) - GAP) * em) / 2;
  [...text].forEach((ch, i) => {
    const x = left + i * (WIDTH + GAP) * em;
    for (const line of GLYPHS[ch] ?? []) {
      strokeLine(
        canvas,
        line.map(([px, py]) => [x + px * WIDTH * em, cy - em / 2 + py * em]),
        em / 7,
        color,
      );
    }
  });
}
