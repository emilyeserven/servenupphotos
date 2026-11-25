import { type BookPage, isOtherPage } from "@/lib/photo-book";
import { type BookUnit, isPlaceholder, printedPages } from "@/lib/photo-book-order";

/** One page of the book as the List tab shows it: its number in the printed book and the page. */
export interface ListedPage {
  number: number;
  page: BookPage;
}

/**
 * The book's pages in printed order, numbered as printed, without the blank pages the Book tab adds
 * (their numbers are skipped) or the inside covers.
 */
export function listedPages(used: BookUnit[]): ListedPage[] {
  return printedPages(used).flatMap((page, i) =>
    isPlaceholder(page) ? [] : [{ number: i + 1, page }],
  );
}

/** How many photos are on the pages, counting each place that has one. */
export function photoCount(pages: ListedPage[]): number {
  return pages.reduce(
    (n, { page }) =>
      n + (isOtherPage(page) ? 0 : page.slots.filter((slot) => slot.photo !== "").length),
    0,
  );
}
