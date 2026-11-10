import type { Size } from "@/lib/crop";
import { type BoxCorner, type FaceBox, type Point, type Rect, blockSide } from "@/lib/face-boxes";

/** The smallest a box can shrink to while resizing it turned, in the photo's pixels. */
const MIN_SIDE = 16;

/** The sine and cosine of face's turn. */
function turnOf(face: FaceBox): { sin: number; cos: number } {
  const radians = ((face.rotation ?? 0) * Math.PI) / 180;
  return { sin: Math.sin(radians), cos: Math.cos(radians) };
}

/** The middle of face's box, which it turns about. */
export function boxCenter(face: FaceBox): Point {
  return { x: face.x + face.width / 2, y: face.y + face.height / 2 };
}

/** The point x, y in face's own frame, from its middle and turned back: where it is on the box before it's turned. */
function local(face: FaceBox, x: number, y: number): Point {
  const { sin, cos } = turnOf(face);
  const c = boxCenter(face);
  return { x: (x - c.x) * cos + (y - c.y) * sin, y: -(x - c.x) * sin + (y - c.y) * cos };
}

/** Whether the point x, y is inside face's area: its box or circle, turned about its middle. */
export function inArea(face: FaceBox, x: number, y: number): boolean {
  const p = local(face, x, y);
  const rx = face.width / 2;
  const ry = face.height / 2;
  if (face.shape === "circle") return (p.x / rx) ** 2 + (p.y / ry) ** 2 <= 1;
  return Math.abs(p.x) <= rx && Math.abs(p.y) <= ry;
}

/** The smallest rectangle of whole pixels around face's area once it's turned, as the backend has it. */
export function areaBounds(face: FaceBox): Rect {
  const { sin, cos } = turnOf(face);
  const c = boxCenter(face);
  const hw = (face.width / 2) * Math.abs(cos) + (face.height / 2) * Math.abs(sin);
  const hh = (face.width / 2) * Math.abs(sin) + (face.height / 2) * Math.abs(cos);
  const x = Math.floor(c.x - hw);
  const y = Math.floor(c.y - hh);
  return { x, y, width: Math.ceil(c.x + hw) - x, height: Math.ceil(c.y + hh) - y };
}

/** Whether any pixel of cell has its middle inside face's area. */
function touched(face: FaceBox, cell: Rect): boolean {
  for (let y = cell.y; y < cell.y + cell.height; y++) {
    for (let x = cell.x; x < cell.x + cell.width; x++) {
      if (inArea(face, x + 0.5, y + 0.5)) return true;
    }
  }
  return false;
}

/** A turned area's blocks: square with the photo, from the top left of its bounds, as the backend makes them. */
export interface TurnedGrid {
  /** The bounds the blocks cover, a whole number of blocks across and down. */
  cover: Rect;
  cols: number;
  rows: number;
  /** The blocks the area touches: the ones pixelated whole with whole-block edges. */
  cells: Rect[];
}

/** The blocks of a turned face, and which of them it touches. */
export function turnedGrid(face: FaceBox): TurnedGrid {
  const bounds = areaBounds(face);
  const side = blockSide(face);
  const cols = Math.max(1, Math.ceil(bounds.width / side));
  const rows = Math.max(1, Math.ceil(bounds.height / side));
  const cells: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = {
        x: bounds.x + col * side,
        y: bounds.y + row * side,
        width: side,
        height: side,
      };
      const clippedCell = {
        ...cell,
        width: Math.min(side, bounds.x + bounds.width - cell.x),
        height: Math.min(side, bounds.y + bounds.height - cell.y),
      };
      if (touched(face, clippedCell)) cells.push(cell);
    }
  }
  return { cover: { ...bounds, width: cols * side, height: rows * side }, cols, rows, cells };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * A turned box after its corner is dragged by dx, dy on the photo: it grows along its own turned
 * sides, and the opposite corner stays where it is.
 */
export function turnedResize(
  start: FaceBox,
  corner: BoxCorner,
  dx: number,
  dy: number,
  photo: Size,
): FaceBox {
  const { sin, cos } = turnOf(start);
  // The drag in the box's own frame.
  const du = dx * cos + dy * sin;
  const dv = -dx * sin + dy * cos;
  const width = clamp(start.width + corner.dx * du, MIN_SIDE, photo.width);
  const height = clamp(start.height + corner.dy * dv, MIN_SIDE, photo.height);
  // The opposite corner, from the middle in the box's frame, before and after.
  const before = { u: (-corner.dx * start.width) / 2, v: (-corner.dy * start.height) / 2 };
  const after = { u: (-corner.dx * width) / 2, v: (-corner.dy * height) / 2 };
  const c = boxCenter(start);
  const center = {
    x: c.x + (before.u - after.u) * cos - (before.v - after.v) * sin,
    y: c.y + (before.u - after.u) * sin + (before.v - after.v) * cos,
  };
  return { ...start, x: center.x - width / 2, y: center.y - height / 2, width, height };
}

/**
 * The turn that points the handle on the middle of a box's right side at `pointer`, in whole
 * degrees; with `snap`, to the nearest 15°.
 */
export function turnToward(center: Point, pointer: Point, snap: boolean): number {
  const degrees = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI;
  const step = snap ? 15 : 1;
  const turn = Math.round(degrees / step) * step;
  return turn <= -180 ? turn + 360 : turn;
}
