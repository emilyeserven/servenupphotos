import type { BookPdfProgress } from "@/api/photo-books";
import { type BookSize, DEFAULT_SIZE, type PageSide, type PhotoBook } from "@/lib/photo-book";
import { count } from "@portfolio/lib/words";

/** The ID of the element **Save as PDF** draws the book's pages in. */
export const PRINT_ROOT_ID = "photo-book-print";

/** The book's page width and height as CSS lengths in its own unit, such as `12.5in`. */
export function printSize(book: Pick<PhotoBook, "size">): { width: string; height: string } {
  const size: BookSize = book.size ?? DEFAULT_SIZE;
  return { width: `${size.width}${size.unit}`, height: `${size.height}${size.unit}` };
}

/**
 * The style sheet for **Save as PDF**: each sheet of paper the book's page size with no margin;
 * printed, only the book's pages; on the screen, the pages kept out of sight while they're drawn.
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

/** A srcset with each of its URLs made whole against base, so a page opened elsewhere finds them. */
export function absoluteSrcSet(srcSet: string, base: string): string {
  return srcSet
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const [url = "", ...descriptor] = candidate.split(/\s+/);
      return [new URL(url, base).href, ...descriptor].join(" ");
    })
    .join(", ");
}

/**
 * The whole page the backend prints to the PDF: the pipeline's style sheets, then the book's pages
 * as drawn, with base for any address the pages give without their host.
 */
export function pdfDocument(parts: { styles: string; pages: string; base: string }): string {
  const base = parts.base.replaceAll('"', "%22");
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<base href="${base}">`,
    `<style>${parts.styles.replaceAll("</style", "<\\/style")}</style>`,
    '</head><body style="margin: 0">',
    parts.pages,
    "</body></html>",
  ].join("");
}

/**
 * What **Save as PDF** says while the PDF is made: drawing the pages here, then how far the backend
 * has got, from its progress when it has started.
 */
export function pdfProgressText(drawing: boolean, progress: BookPdfProgress | undefined): string {
  if (drawing) return "Drawing the pages…";
  if (!progress?.running) return "Making the PDF…";
  switch (progress.step) {
    case "photos":
      return `Loading photos: ${progress.done} of ${progress.total}`;
    case "printing":
      return `Printing ${count(progress.total, "page")}…`;
    default:
      return "Starting Chrome…";
  }
}
