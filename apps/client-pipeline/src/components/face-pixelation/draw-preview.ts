import type { Size } from "@/lib/crop";
import { type FaceBox, type Rect, touchedCells } from "@/lib/face-boxes";
import { boxCenter, turnedGrid } from "@/lib/face-turn";

/** The longest edge the preview is drawn at unzoomed; the page shows it smaller, so more is wasted. */
const PREVIEW_EDGE = 1600;
/** The longest edge it's ever drawn at, however far it's zoomed in, to keep the canvas's memory small. */
const MAX_EDGE = 4096;

/** The photo loaded for drawing, with its size as it's shown. */
export interface Loaded {
  image: HTMLImageElement;
  photo: Size;
}

/** A canvas's 2D context with the photo-to-canvas scale. */
interface Target {
  ctx: CanvasRenderingContext2D;
  scale: number;
}

/**
 * Draws image on canvas as the versions will show it: every face pixelated, then every kept area
 * drawn back from the photo, the way the backend makes them. Zoomed in, it's drawn sharper.
 */
export function drawPreview(
  canvas: HTMLCanvasElement,
  { image, photo }: Loaded,
  faces: FaceBox[],
  zoom = 1,
) {
  const edge = Math.min(MAX_EDGE, PREVIEW_EDGE * zoom);
  const scale = Math.min(1, edge / Math.max(photo.width, photo.height));
  canvas.width = Math.round(photo.width * scale);
  canvas.height = Math.round(photo.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const target = { ctx, scale };
  for (const face of faces.filter((f) => !f.keep)) pixelate(target, image, face);
  for (const face of faces.filter((f) => f.keep)) {
    clipped(target, outline(face), () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height));
  }
}

/** The blocks across and down face's box, each about as big as the backend makes them. */
function grid(face: FaceBox) {
  const side = Math.max(face.width, face.height) / Math.max(1, face.blocks);
  return {
    cols: Math.max(1, Math.ceil(face.width / side)),
    rows: Math.max(1, Math.ceil(face.height / side)),
  };
}

/** Where face's blocks are drawn from, in photo pixels, and how many across and down. */
interface Blocks {
  area: Rect;
  cols: number;
  rows: number;
}

/** face's blocks: over its box, or over its bounds once it's turned, as the backend makes them. */
function blocksOf(face: FaceBox): Blocks {
  if (!face.rotation) return { area: face, ...grid(face) };
  const { cover, cols, rows } = turnedGrid(face);
  return { area: cover, cols, rows };
}

/**
 * Pixelates face: shrinks it to one pixel per block, then stretches that back without smoothing,
 * so each block is about the average of the pixels under it, clipped to the face's shape.
 */
function pixelate(target: Target, image: HTMLImageElement, face: FaceBox) {
  const { area, cols, rows } = blocksOf(face);
  const tiny = document.createElement("canvas");
  tiny.width = cols;
  tiny.height = rows;
  const tinyCtx = tiny.getContext("2d");
  if (!tinyCtx) return;
  tinyCtx.imageSmoothingQuality = "high";
  tinyCtx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, cols, rows);
  const { ctx, scale } = target;
  const shape = face.edge === "blocks" ? blockOutline(face, cols, rows) : outline(face);
  clipped(target, shape, () => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, area.x * scale, area.y * scale, area.width * scale, area.height * scale);
  });
}

/** A path that adds face's outline, in photo pixels, to a context scaled to the photo. */
type Outline = (ctx: CanvasRenderingContext2D) => void;

/** The face's box, or the circle that fits in it, turned about its middle. */
function outline(face: FaceBox): Outline {
  const rx = face.width / 2;
  const ry = face.height / 2;
  const turn = ((face.rotation ?? 0) * Math.PI) / 180;
  const { x, y } = boxCenter(face);
  if (face.shape === "circle") return (ctx) => ctx.ellipse(x, y, rx, ry, turn, 0, Math.PI * 2);
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  const corners = [
    [-rx, -ry],
    [rx, -ry],
    [rx, ry],
    [-rx, ry],
  ] as const;
  return (ctx) => {
    for (const [u, v] of corners) ctx.lineTo(x + u * cos - v * sin, y + u * sin + v * cos);
    ctx.closePath();
  };
}

/**
 * The blocks an area touches, for a circle or turned box with whole-block edges; the box for a
 * plain box.
 */
function blockOutline(face: FaceBox, cols: number, rows: number): Outline {
  if (face.rotation) return cellsOutline(turnedGrid(face).cells);
  if (face.shape !== "circle") return outline(face);
  return cellsOutline(touchedCells(face, cols, rows));
}

/** The cells, as one path. */
function cellsOutline(cells: Rect[]): Outline {
  return (ctx) => {
    for (const cell of cells) ctx.rect(cell.x, cell.y, cell.width, cell.height);
  };
}

/** Runs draw with the canvas clipped to shape, then puts the canvas back as it was. */
function clipped({ ctx, scale }: Target, shape: Outline, draw: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.scale(scale, scale);
  shape(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clip();
  draw();
  ctx.restore();
}
