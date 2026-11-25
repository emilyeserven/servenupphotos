import { type BookPage, type PhotoBook, TEXT_PAGE_PHOTOS } from "@/lib/photo-book";

/** The most columns a text page's text flows into. */
export const TEXT_PAGE_COLUMNS = 3;

/** Whether the page is a text page: a title and text, with photos under them if wanted. */
export function isTextPage(page: Pick<BookPage, "layout">): boolean {
  return page.layout === "text";
}

/** How many columns the page's text flows into: 1 to TEXT_PAGE_COLUMNS, 1 when none is set. */
export function textColumns(page: Pick<BookPage, "columns">): number {
  const n = Math.round(page.columns ?? 1);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), TEXT_PAGE_COLUMNS) : 1;
}

/** The book with the page at index changed by change. */
function changePage(book: PhotoBook, index: number, change: (page: BookPage) => BookPage) {
  return { ...book, pages: book.pages.map((page, i) => (i === index ? change(page) : page)) };
}

/** The book with the text page at index's text, in Markdown, set to text. */
export function setPageText(book: PhotoBook, index: number, text: string): PhotoBook {
  return changePage(book, index, (page) => ({ ...page, text }));
}

/** The book with the text page at index's text flowing into columns columns, 1 to TEXT_PAGE_COLUMNS. */
export function setTextColumns(book: PhotoBook, index: number, columns: number): PhotoBook {
  return changePage(book, index, (page) => {
    const n = textColumns({ columns });
    if (n === 1) {
      const { columns: _columns, ...rest } = page;
      return rest;
    }
    return { ...page, columns: n };
  });
}

/**
 * The book with the text page at index holding count photo places, 0 to TEXT_PAGE_PHOTOS: new ones
 * are added empty at the end, and the last ones taken off with their photos.
 */
export function setPhotoPlaces(book: PhotoBook, index: number, count: number): PhotoBook {
  const n = Math.min(Math.max(Math.round(count), 0), TEXT_PAGE_PHOTOS);
  return changePage(book, index, (page) => ({
    ...page,
    slots: Array.from({ length: n }, (_, i) => page.slots[i] ?? { photo: "", caption: null }),
  }));
}
