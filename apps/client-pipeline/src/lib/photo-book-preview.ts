import type { BuiltInLayout, PageLayout, PageSide, PhotoBook } from "@/lib/photo-book";
import { BUILT_IN_LOOKS, customLayout, photoShape, sideLook } from "@/lib/photo-book-layouts";

/** Which photos suit a frame: wider than tall, taller than wide, or any, for a square frame or one that fills its room. */
export type FrameFit = "landscape" | "portrait" | "any";

/** How much wider than tall (or taller than wide) a frame or photo has to be to count as one. */
const SQUARE_MARGIN = 1.05;

/** Whether a width over height is landscape, portrait, or close enough to square to be either. */
function fitOf(aspect: number): FrameFit {
  if (aspect > SQUARE_MARGIN) return "landscape";
  if (aspect < 1 / SQUARE_MARGIN) return "portrait";
  return "any";
}

/**
 * What photos suit each of layout's frames on a page on side: its photos' shape as a fit, every
 * frame the same, as layouts shape every photo alike; none for an other or text page.
 */
export function frameFits(book: PhotoBook, layout: PageLayout, side: PageSide): FrameFit[] {
  const custom = customLayout(book, layout);
  const look = custom ? sideLook(custom, side) : BUILT_IN_LOOKS[layout as BuiltInLayout];
  if (!look) return [];
  const shape = photoShape(look);
  return Array.from({ length: look.photos }, () => (shape === "fill" ? "any" : fitOf(shape)));
}

/** A photo's width over its height from its file's data, or null when the data doesn't say. */
export function photoAspect(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const { width, height } = data as { width?: unknown; height?: unknown };
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
    return null;
  }
  return width / height;
}

/** Whether a photo of aspect suits a frame of fit; one whose shape isn't known suits any frame. */
function suits(fit: FrameFit, aspect: number | null): boolean {
  if (fit === "any" || aspect === null) return true;
  const photo = fitOf(aspect);
  return photo === fit || photo === "any";
}

/**
 * A photo for each frame of fits, from photos in their order starting at start and going round:
 * the first one not used yet whose shape suits the frame, else the first one not used yet, else
 * none. used is filled with the ones picked, so another page can carry on without repeats.
 */
export function pickForFrames<T>(
  photos: T[],
  fits: FrameFit[],
  start: number,
  aspect: (photo: T) => number | null,
  used: Set<T>,
): (T | undefined)[] {
  const from = photos.length > 0 ? start % photos.length : 0;
  const order = [...photos.slice(from), ...photos.slice(0, from)];
  return fits.map((fit) => {
    const free = order.filter((photo) => !used.has(photo));
    const picked = free.find((photo) => suits(fit, aspect(photo))) ?? free[0];
    if (picked !== undefined) used.add(picked);
    return picked;
  });
}
