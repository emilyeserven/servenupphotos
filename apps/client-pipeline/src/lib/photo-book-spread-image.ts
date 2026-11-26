/** The ID of the element **Save as image** draws the spread shown in. */
export const SPREAD_ROOT_ID = "photo-book-spread-image";

/**
 * How many pixels the longer side of a spread's image has: small enough to paste into an LLM
 * without it being shrunk (Claude shrinks images past about 1568 pixels), big enough to read the
 * captions.
 */
export const SPREAD_IMAGE_LONGEST = 1568;

/**
 * The printed pages view at of the book shows, numbered from 1: view 0 is page 1 alone, facing
 * the inside front cover, then each view an even page and the one after, the last page facing the
 * inside back cover. first and last are the same when the view shows one page.
 */
export function viewPageRange(at: number, total: number): { first: number; last: number } {
  return { first: Math.max(1, 2 * at), last: Math.min(total, 2 * at + 1) };
}

/** What the image of view at is called, such as `korea-2026-pages-4-5.webp` or `korea-2026-page-1.webp`. */
export function spreadImageName(id: string, at: number, total: number): string {
  const { first, last } = viewPageRange(at, total);
  return first === last ? `${id}-page-${first}.webp` : `${id}-pages-${first}-${last}.webp`;
}
