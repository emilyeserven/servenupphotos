import type { Size } from "@/lib/crop";

/**
 * A box on a photo to hide by pixelating it, in pixels of the photo as it's shown (turned upright
 * from its EXIF orientation), as the backend takes it.
 */
export interface FaceBox {
  /** The box's top-left corner. */
  x: number;
  y: number;
  /** The box's size. */
  width: number;
  height: number;
  /** The pixelation's density: how many blocks fit across the box's longer side. Fewer hide more. */
  blocks: number;
}

/** The fewest and most blocks a face may have across its longer side, as the backend allows. */
export const MIN_BLOCKS = 3;
export const MAX_BLOCKS = 40;

/** How many blocks a new box starts with, the same as a found face. */
const DEFAULT_BLOCKS = 8;

/** The most boxes one photo may have, as the backend allows. */
export const MAX_FACES = 40;

/** The smallest a box can shrink to, in the photo's pixels. */
const MIN_SIDE = 16;

/** Which way a dragged corner grows the box: right or down is 1, left or up is -1. */
export interface BoxCorner {
  dx: 1 | -1;
  dy: 1 | -1;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** How many pixels of the photo each block covers, so `blocks` of them span the longer side. */
export function blockSide(face: FaceBox): number {
  return Math.max(1, Math.ceil(Math.max(face.width, face.height) / Math.max(1, face.blocks)));
}

/** face moved by dx, dy, kept inside the photo. */
export function movedBox(face: FaceBox, dx: number, dy: number, photo: Size): FaceBox {
  return {
    ...face,
    x: clamp(face.x + dx, 0, photo.width - face.width),
    y: clamp(face.y + dy, 0, photo.height - face.height),
  };
}

/** One side of a box dragged along one axis: the opposite edge stays put, within the photo. */
function resizedSide(dir: number, start: number, length: number, by: number, limit: number) {
  if (dir > 0) {
    const side = clamp(length + by, Math.min(MIN_SIDE, limit - start), limit - start);
    return { start, length: side };
  }
  const end = start + length;
  const side = clamp(length - by, Math.min(MIN_SIDE, end), end);
  return { start: end - side, length: side };
}

/** start dragged by its corner by dx, dy; the opposite corner stays put, and the box stays inside the photo. */
export function resizedBox(
  start: FaceBox,
  corner: BoxCorner,
  dx: number,
  dy: number,
  photo: Size,
): FaceBox {
  const h = resizedSide(corner.dx, start.x, start.width, dx, photo.width);
  const v = resizedSide(corner.dy, start.y, start.height, dy, photo.height);
  return { ...start, x: h.start, width: h.length, y: v.start, height: v.length };
}

/** The box drawn by dragging from one point to another, inside the photo, with blocks. */
export function drawnBox(
  from: { x: number; y: number },
  to: { x: number; y: number },
  photo: Size,
  blocks = DEFAULT_BLOCKS,
): FaceBox {
  const x0 = clamp(Math.min(from.x, to.x), 0, photo.width);
  const y0 = clamp(Math.min(from.y, to.y), 0, photo.height);
  const x1 = clamp(Math.max(from.x, to.x), 0, photo.width);
  const y1 = clamp(Math.max(from.y, to.y), 0, photo.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, blocks };
}

/** Whether a drawn box is big enough to keep, rather than a stray click. */
export function isBigEnough(face: FaceBox): boolean {
  return face.width >= MIN_SIDE && face.height >= MIN_SIDE;
}

/** A square box in the middle of the photo, a sixth of its shorter side, for adding one by hand. */
export function middleBox(photo: Size, blocks = DEFAULT_BLOCKS): FaceBox {
  const side = Math.max(MIN_SIDE, Math.round(Math.min(photo.width, photo.height) / 6));
  return {
    x: Math.round((photo.width - side) / 2),
    y: Math.round((photo.height - side) / 2),
    width: side,
    height: side,
    blocks,
  };
}

/** face in whole pixels with its blocks in range, as the backend takes it. */
export function roundedBox(face: FaceBox): FaceBox {
  const x = Math.max(0, Math.round(face.x));
  const y = Math.max(0, Math.round(face.y));
  return {
    x,
    y,
    width: Math.max(1, Math.round(face.width)),
    height: Math.max(1, Math.round(face.height)),
    blocks: clamp(Math.round(face.blocks), MIN_BLOCKS, MAX_BLOCKS),
  };
}

/** Whether a and b are the same boxes, in the same order, to the pixel. */
export function sameBoxes(a: FaceBox[], b: FaceBox[]): boolean {
  const key = (faces: FaceBox[]) => JSON.stringify(faces.map(roundedBox));
  return key(a) === key(b);
}

/** How much a and b overlap: the area they share over the area they cover together, from 0 to 1. */
function overlap(a: FaceBox, b: FaceBox): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const shared = w * h;
  return shared / (a.width * a.height + b.width * b.height - shared);
}

/** The found faces that aren't already boxed: any that mostly overlaps an existing box is left out. */
export function newFaces(existing: FaceBox[], found: FaceBox[]): FaceBox[] {
  return found.filter((face) => existing.every((box) => overlap(box, face) < 0.3));
}

/** What each key does to a focused box: arrows move it about 1% of the photo, 10% with Shift. */
export function keyedBox(
  key: string,
  shift: boolean,
  face: FaceBox,
  photo: Size,
): FaceBox | undefined {
  const step =
    Math.max(1, Math.round(Math.max(photo.width, photo.height) / 100)) * (shift ? 10 : 1);
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = moves[key];
  return move && movedBox(face, move[0], move[1], photo);
}

/** Where a box is, in words: "a 320 × 400 px box at 1200, 300, 8 blocks across". */
export function boxText(face: FaceBox): string {
  const { x, y, width, height, blocks } = roundedBox(face);
  return `a ${width} × ${height} px box at ${x}, ${y}, ${blocks} blocks across`;
}

/** The photo's version keys in `images`, whose URLs change when the faces on them do. */
const MARKED_IMAGES = [
  "xlarge",
  "large",
  "medium",
  "small",
  "xsmall",
  "preview",
  "thumbnail",
  "thumbnailpreview",
] as const;

/**
 * images with every version's URL marked with `faces=<mark>`, keeping any other mark such as the
 * Square Thumbnail's crop. The versions keep their keys when they're remade, so the new URL makes
 * browsers and Cloudflare's cache fetch the pixelated version instead of the old one; R2 ignores it.
 */
export function withFacesMark(
  images: Record<string, unknown> | undefined,
  mark: string,
): Record<string, unknown> {
  const next = { ...images };
  for (const name of MARKED_IMAGES) {
    const url = next[name];
    if (typeof url !== "string" || !url) continue;
    const [base, query = ""] = url.split("?", 2) as [string, string?];
    const params = new URLSearchParams(query.replace(/#.*$/, ""));
    params.set("faces", mark);
    next[name] = `${base}?${params.toString().replaceAll("%2C", ",")}`;
  }
  return next;
}
