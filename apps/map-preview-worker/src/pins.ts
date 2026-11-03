/**
 * The photo pins on a map preview: grouped the way the map groups them, then drawn like its
 * markers. A photo is a rounded square in the photo's average color (the map shows its thumbnail
 * there), and a group is a dark circle with how many photos it has.
 */
import { drawNumber } from "./digits.ts";
import { type Canvas, type Color, fillCircle, fillRoundedSquare, hexColor } from "./draw.ts";
import { type Frame, IMAGE, pointIn, SCALE } from "./view.ts";

/** One photo on the map, as `map-pins.json` lists it: longitude, latitude, and average color. */
export type Pin = [number, number, string | null];

/** A pin or group of pins as drawn, in image pixels. */
export interface Marker {
  x: number;
  y: number;
  count: number;
  color: string | null;
}

/** A Medium pin's size, and how close photos are before they're grouped, in the map's pixels (PIN_PIXELS and clusterRadius in the portfolio). */
const PIN = 44 * SCALE;
const GROUPING = 40 * SCALE;
const RING = 2 * SCALE;
const WHITE: Color = [255, 255, 255];
const GROUP_FILL: Color = [23, 23, 23];
/** The color of a photo with no colors saved yet (sky-300, like the map's dots). */
const NO_COLOR: Color = [125, 211, 252];

/** Whether a point is in the image or near enough that its pin shows. */
function inImage({ x, y }: { x: number; y: number }): boolean {
  const margin = PIN;
  return x > -margin && y > -margin && x < IMAGE.width + margin && y < IMAGE.height + margin;
}

/** Joins a marker with a point: their center moves to the middle of all their photos. */
function absorb(group: Marker, point: Marker): void {
  const count = group.count + point.count;
  group.x = (group.x * group.count + point.x) / count;
  group.y = (group.y * group.count + point.y) / count;
  group.count = count;
}

/**
 * The pins grouped like the map groups them: each photo, in turn, joins the first group whose
 * center is within the grouping distance, or starts its own.
 */
export function markersOf(frame: Frame, pins: Pin[]): Marker[] {
  const markers: Marker[] = [];
  for (const [lng, lat, color] of pins) {
    const point = { ...pointIn(frame, lng, lat), count: 1, color };
    if (!inImage(point)) continue;
    const near = markers.find((m) => Math.hypot(m.x - point.x, m.y - point.y) <= GROUPING);
    if (near) absorb(near, point);
    else markers.push(point);
  }
  return markers;
}

/** The soft shadow under a marker, like the map's `shadow-md`. */
const SHADOW = { opacity: 0.3, feather: 8 * SCALE };

/** Draws one photo: its color in a rounded square with a white border. */
function drawPhoto(canvas: Canvas, { x, y, color }: Marker) {
  const half = PIN / 2;
  fillRoundedSquare(canvas, [x, y + 2 * SCALE], half, 6 * SCALE, [0, 0, 0], SHADOW);
  fillRoundedSquare(canvas, [x, y], half + RING, 6 * SCALE + RING, WHITE);
  fillRoundedSquare(canvas, [x, y], half, 6 * SCALE, hexColor(color, NO_COLOR));
}

/** Draws one group: a dark circle with a white border and its count. */
function drawGroup(canvas: Canvas, { x, y, count }: Marker) {
  const r = PIN / 2;
  fillCircle(canvas, x, y + 2 * SCALE, r, [0, 0, 0], SHADOW);
  fillCircle(canvas, x, y, r + RING, WHITE);
  fillCircle(canvas, x, y, r, GROUP_FILL);
  drawNumber(canvas, String(count), [x, y], [PIN * 0.62, PIN * 0.32], WHITE);
}

/** Draws the markers, single photos first, so groups stay on top. */
export function drawMarkers(canvas: Canvas, markers: Marker[]) {
  const groups = markers.filter((marker) => marker.count > 1);
  for (const marker of markers.filter((m) => m.count === 1)) drawPhoto(canvas, marker);
  for (const marker of groups) drawGroup(canvas, marker);
}
