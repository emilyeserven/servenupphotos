/** A square on a photo, in pixels of the photo as it's shown (turned upright from its EXIF orientation). */
export interface Crop {
  /** The square's top-left corner. */
  x: number;
  y: number;
  /** The square's width and height. */
  size: number;
}

/** A photo's size in pixels, as it's shown. */
export interface Size {
  width: number;
  height: number;
}

/** A corner of a crop, as which way it grows when dragged out: right or down is 1, left or up is -1. */
export interface Corner {
  dx: 1 | -1;
  dy: 1 | -1;
}

/** The smallest square a crop can shrink to, in the photo's pixels. */
const MIN_CROP = 50;

/** The largest square in the middle of a photo, the part `object-fit: cover` shows. */
export function centerCrop({ width, height }: Size): Crop {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

/** Whether a and b are the same square, to the pixel. */
export function sameCrop(a: Crop, b: Crop): boolean {
  return [a.x - b.x, a.y - b.y, a.size - b.size].every((d) => Math.abs(d) < 0.5);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** crop moved by dx, dy, kept inside the photo. */
export function moved(crop: Crop, dx: number, dy: number, photo: Size): Crop {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, photo.width - crop.size),
    y: clamp(crop.y + dy, 0, photo.height - crop.size),
  };
}

/** Where the corner opposite the dragged one is, along one axis. */
const anchorOf = (dir: number, start: number, side: number) => (dir > 0 ? start : start + side);

/** How far a crop can grow from its anchor, along one axis, before it leaves the photo. */
const roomFrom = (dir: number, anchor: number, length: number) =>
  dir > 0 ? length - anchor : anchor;

/** The crop's top or left edge, along one axis, for a side grown from its anchor. */
const fromAnchor = (dir: number, anchor: number, side: number) =>
  dir > 0 ? anchor : anchor - side;

/**
 * start dragged by its corner by dx, dy, staying square: the opposite corner stays put, and the
 * square grows as far as the farther of the two moves, but no farther than the photo's edges.
 */
export function resized(start: Crop, corner: Corner, dx: number, dy: number, photo: Size): Crop {
  const anchorX = anchorOf(corner.dx, start.x, start.size);
  const anchorY = anchorOf(corner.dy, start.y, start.size);
  const room = Math.min(
    roomFrom(corner.dx, anchorX, photo.width),
    roomFrom(corner.dy, anchorY, photo.height),
  );
  const wanted = start.size + Math.max(corner.dx * dx, corner.dy * dy);
  const side = clamp(wanted, Math.min(MIN_CROP, room), room);
  return {
    x: fromAnchor(corner.dx, anchorX, side),
    y: fromAnchor(corner.dy, anchorY, side),
    size: side,
  };
}

/** crop grown by by pixels (shrunk when negative) around its center, kept inside the photo. */
function grown(crop: Crop, by: number, photo: Size): Crop {
  const largest = Math.min(photo.width, photo.height);
  const side = clamp(crop.size + by, Math.min(MIN_CROP, largest), largest);
  const center = { x: crop.x + crop.size / 2, y: crop.y + crop.size / 2 };
  return moved({ x: center.x - side / 2, y: center.y - side / 2, size: side }, 0, 0, photo);
}

type KeyAction = (crop: Crop, step: number, photo: Size) => Crop;

/** What each key does to a focused crop: arrows move it, + and - resize it around its center. */
const KEY_ACTIONS: Record<string, KeyAction> = {
  ArrowLeft: (crop, step, photo) => moved(crop, -step, 0, photo),
  ArrowRight: (crop, step, photo) => moved(crop, step, 0, photo),
  ArrowUp: (crop, step, photo) => moved(crop, 0, -step, photo),
  ArrowDown: (crop, step, photo) => moved(crop, 0, step, photo),
  "+": (crop, step, photo) => grown(crop, step, photo),
  "=": (crop, step, photo) => grown(crop, step, photo),
  "-": (crop, step, photo) => grown(crop, -step, photo),
};

/** How far one key press moves a crop: about 1% of the photo, or 10% with Shift. */
function keyStep(photo: Size, shift: boolean): number {
  const step = Math.max(1, Math.round(Math.max(photo.width, photo.height) / 100));
  return shift ? step * 10 : step;
}

/** crop after pressing key, or undefined for a key that does nothing to it. */
export function keyedCrop(key: string, shift: boolean, crop: Crop, photo: Size): Crop | undefined {
  return KEY_ACTIONS[key]?.(crop, keyStep(photo, shift), photo);
}

/** Where a crop is, in words: "a 1200 × 1200 px square at 300, 0". */
export function cropText(crop: Crop): string {
  const side = Math.round(crop.size);
  return `a ${side} × ${side} px square at ${Math.round(crop.x)}, ${Math.round(crop.y)}`;
}
