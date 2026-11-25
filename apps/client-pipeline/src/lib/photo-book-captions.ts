import type { BookSlot, PhotoBook } from "@/lib/photo-book";

/** Whether a place's caption was typed over, with a photo whose template caption could replace it. */
function typedOver(slot: BookSlot): boolean {
  return slot.photo !== "" && slot.caption !== null;
}

/** How many of the book's captions were typed over instead of filled in from the caption template. */
export function typedCaptionCount(book: PhotoBook): number {
  return book.pages.reduce((n, page) => n + page.slots.filter(typedOver).length, 0);
}

/**
 * The book with every caption typed over filled in from the caption template again, as **From
 * template** does for one. An empty place's typed caption is kept, since no photo fills it in.
 */
export function refreshCaptions(book: PhotoBook): PhotoBook {
  return {
    ...book,
    pages: book.pages.map((page) =>
      page.slots.some(typedOver)
        ? { ...page, slots: page.slots.map((s) => (typedOver(s) ? { ...s, caption: null } : s)) }
        : page,
    ),
  };
}
