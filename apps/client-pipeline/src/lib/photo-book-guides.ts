import { DEFAULT_SIZE, type PhotoBook } from "@/lib/photo-book";
import { blurbOf } from "@/lib/photo-book-cover";
import { pageWidthInches } from "@/lib/photo-book-dpi";

/** Blurb's safe boundary inside the trimmed top, bottom and outside edges, in inches. */
const SAFE_INSET = 0.25;
/** Blurb's safe boundary inside the binding edge, in inches. */
const BINDING_INSET = 0.5;
/** The bleed Blurb asks for on a page's top, bottom and outside edges, used when the book's page size has no printed size. */
const DEFAULT_BLEED = 0.125;

/**
 * Where Blurb trims a page and where its safe boundary is, as a page is printed by **PDF for
 * Blurb** (drawn at Blurb's page size), each in percent of the page's width or height: the bleed
 * Blurb trims off the top and bottom (`top`) and the outside edge (`outside`), and the safe boundary
 * in from the top and bottom (`safeTop`), the outside edge (`safeOutside`) and the binding edge
 * (`safeBinding`), where there's no bleed.
 */
export interface PageGuides {
  top: number;
  outside: number;
  safeTop: number;
  safeOutside: number;
  safeBinding: number;
}

/**
 * The bleed on a page's top and bottom and its outside edge, in inches: what Blurb's page PDF adds
 * to the book's page size, or Blurb's 0.125 in when the book's size is in pixels or larger than
 * Blurb's page.
 */
function pageBleed(book: Pick<PhotoBook, "size" | "blurb">): { top: number; outside: number } {
  const { pageWidth, pageHeight } = blurbOf(book);
  const width = pageWidthInches(book);
  const size = book.size ?? DEFAULT_SIZE;
  if (width === null) return { top: DEFAULT_BLEED, outside: DEFAULT_BLEED };
  const height = (width * size.height) / size.width;
  const top = (pageHeight - height) / 2;
  const outside = pageWidth - width;
  return top >= 0 && outside >= 0
    ? { top, outside }
    : { top: DEFAULT_BLEED, outside: DEFAULT_BLEED };
}

/** The book's page guides for Blurb, from its page size and its Blurb sizes. */
export function pageGuides(book: Pick<PhotoBook, "size" | "blurb">): PageGuides {
  const { pageWidth, pageHeight } = blurbOf(book);
  const bleed = pageBleed(book);
  const across = (inches: number) => (inches / pageWidth) * 100;
  const down = (inches: number) => (inches / pageHeight) * 100;
  return {
    top: down(bleed.top),
    outside: across(bleed.outside),
    safeTop: down(bleed.top + SAFE_INSET),
    safeOutside: across(bleed.outside + SAFE_INSET),
    safeBinding: across(BINDING_INSET),
  };
}
