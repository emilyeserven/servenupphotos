import type { CaptionTemplate } from "@/api/captions";
import type { SocialPhoto } from "@/api/publish";
import { useCaptionFor, usePartsFor } from "@/components/photo-book/book-captions";
import type { PageLook } from "@/components/photo-book/page-actions";
import { previewLook } from "@/components/photo-book/print-look";
import { usePlacesIndexFor } from "@/components/photo-book/use-places-index";
import type { PhotoBook } from "@/lib/photo-book";
import { pageGuides } from "@/lib/photo-book-guides";
import { pageSides } from "@/lib/photo-book-order";
import { printGuides } from "@/stores/photo-book-guides";
import { printPreview } from "@/stores/photo-book-print-preview";

/**
 * The look every page of the open book is drawn with: its photos, captions and sizes, Blurb's
 * guides while **Show bleed and safe boundary** is on, and, on a tab that can (canPrint) while
 * **Preview** is on **Print (Blurb)**, the pages as **PDF for Blurb** prints them.
 */
export function useBookLook(
  book: PhotoBook,
  photos: Map<string, SocialPhoto>,
  template: CaptionTemplate | undefined,
  canPrint: boolean,
): PageLook {
  const showGuides = printGuides.use();
  const print = printPreview.use();
  const look: PageLook = {
    photos,
    captionFor: useCaptionFor(photos, template, book),
    partsFor: usePartsFor(photos, template, book),
    layouts: book.layouts ?? [],
    sides: pageSides(book),
    noTitles: book.noTitles === true,
    placesIndexFor: usePlacesIndexFor(book, photos),
    guides: showGuides ? pageGuides(book) : null,
    // The page size and print offsets are set by previewLook, for the version shown.
    aspect: 1,
    printWidth: null,
    printOffsets: false,
  };
  return previewLook(book, look, print, canPrint);
}
