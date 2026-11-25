import { type BookSize, DEFAULT_SIZE, type PageSide, type PhotoBook } from "@/lib/photo-book";

/** The ID of the element **Save as PDF** draws the book's pages in. */
export const PRINT_ROOT_ID = "photo-book-print";

/** The book's page width and height as CSS lengths in its own unit, such as `12.5in`. */
export function printSize(book: Pick<PhotoBook, "size">): { width: string; height: string } {
  const size: BookSize = book.size ?? DEFAULT_SIZE;
  return { width: `${size.width}${size.unit}`, height: `${size.height}${size.unit}` };
}

/**
 * The style sheet for **Save as PDF**: each sheet of paper the book's page size with no margin;
 * printed, only the book's pages; on the screen, the pages kept out of sight while they load.
 */
export function printCss(book: Pick<PhotoBook, "size">): string {
  const { width, height } = printSize(book);
  return [
    `@page { size: ${width} ${height}; margin: 0; }`,
    `@media print { body > :not(#${PRINT_ROOT_ID}) { display: none !important; } }`,
    `@media screen { #${PRINT_ROOT_ID} { position: fixed; top: 0; left: -300vw; } }`,
  ].join("\n");
}

/** The side of the open book the printed page at place i (0 for page 1) is on: odd pages are right. */
export function printSide(i: number): PageSide {
  return i % 2 === 0 ? "right" : "left";
}
