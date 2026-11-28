import type { PageLook } from "@/components/photo-book/page-actions";
import { type PhotoBook, pageAspect } from "@/lib/photo-book";
import { blurbOf } from "@/lib/photo-book-cover";
import { pageWidthInches } from "@/lib/photo-book-dpi";

/**
 * The look pages have in **PDF for Blurb**: Blurb's page size, in inches, with the layouts' print
 * offsets added to their margins.
 */
export function printLook(book: PhotoBook, look: PageLook): PageLook {
  const { pageWidth, pageHeight } = blurbOf(book);
  return { ...look, aspect: pageWidth / pageHeight, printWidth: pageWidth, printOffsets: true };
}

/**
 * The look pages have in **Save as PDF** and **Save as image**: the book's own page size, without
 * the layouts' print offsets.
 */
export function pdfLook(book: PhotoBook, look: PageLook): PageLook {
  return {
    ...look,
    aspect: pageAspect(book),
    printWidth: pageWidthInches(book),
    printOffsets: false,
  };
}

/**
 * The look the preview shows pages with: as **PDF for Blurb** prints them when print is on and the
 * tab can show it (canPrint), else as **Save as PDF** makes them.
 */
export function previewLook(
  book: PhotoBook,
  look: PageLook,
  print: boolean,
  canPrint: boolean,
): PageLook {
  return print && canPrint ? printLook(book, look) : pdfLook(book, look);
}
