import type { BookPdfProgress } from "@/api/photo-books";
import { type BookSize, DEFAULT_SIZE, type PageSide, type PhotoBook } from "@/lib/photo-book";
import { count } from "@portfolio/lib/words";

/** The ID of the element **Save as PDF** draws the book's pages in. */
export const PRINT_ROOT_ID = "photo-book-print";

/**
 * The width and height of a sheet of the PDF as CSS lengths in the book's own unit, such as
 * `12.5in`: the book's page, or two of them side by side when spreads are printed as one sheet.
 */
export function printSize(
  book: Pick<PhotoBook, "size">,
  spreads = false,
): { width: string; height: string } {
  const size: BookSize = book.size ?? DEFAULT_SIZE;
  const width = spreads ? size.width * 2 : size.width;
  return { width: `${width}${size.unit}`, height: `${size.height}${size.unit}` };
}

/**
 * The printed pages, by their place (0 for page 1), as the open book shows them: page 1 alone on
 * the right, opposite the inside front cover, then each left page with the right page after it,
 * and a last left page alone. null is a half with no page of the book, left blank.
 */
export function spreadSheets(pages: number): [number | null, number | null][] {
  if (pages === 0) return [];
  const sheets: [number | null, number | null][] = [[null, 0]];
  for (let left = 1; left < pages; left += 2)
    sheets.push([left, left + 1 < pages ? left + 1 : null]);
  return sheets;
}

/**
 * The style sheet for **Save as PDF**: each sheet of paper the book's page size (two pages wide
 * for spreads) with no margin;
 * printed, only the book's pages; on the screen, the pages kept out of sight while they're drawn.
 */
export function printCss(book: Pick<PhotoBook, "size">, spreads = false): string {
  const { width, height } = printSize(book, spreads);
  return sheetCss(width, height);
}

/**
 * The style sheet for a PDF of sheets width by height (CSS lengths, such as `12.5in`) with no
 * margin: printed, only what's drawn in the print root; on the screen, it kept out of sight.
 */
export function sheetCss(width: string, height: string): string {
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
 * has got, from its progress when it has started, or making until it has. **Save all as images**
 * says the same, with each image it draws.
 */
export function pdfProgressText(
  drawing: boolean,
  progress: BookPdfProgress | undefined,
  making = "Making the PDF…",
): string {
  if (drawing) return "Drawing the pages…";
  if (!progress?.running) return making;
  switch (progress.step) {
    case "photos":
      return `Loading photos: ${progress.done} of ${progress.total}`;
    case "printing":
      return `Printing ${count(progress.total, "page")}…`;
    case "drawing":
      return `Drawing image ${progress.done + 1} of ${progress.total}`;
    default:
      return "Starting Chrome…";
  }
}

/**
 * What a PDF of the book is called, how many sheets it has, and its button's words when idle and
 * tooltip.
 */
export function pdfFile(id: string, printed: number, spreads: boolean) {
  if (!spreads) {
    return {
      name: `${id}.pdf`,
      sheets: printed,
      label: "Save as PDF",
      title:
        "Makes a PDF of every page of the book at its page size, with sharp photos, and downloads it",
    };
  }
  return {
    name: `${id}-spreads.pdf`,
    sheets: spreadSheets(printed).length,
    label: "Save spreads as PDF",
    title:
      "Makes a PDF of the book as it opens, each two-page spread on one sheet two pages wide, and downloads it",
  };
}
