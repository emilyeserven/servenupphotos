import type { PageLayout, PhotoBook, SlotPlace } from "@/lib/photo-book";
import { type BookUnit, type BookView, addPage, addToBook } from "@/lib/photo-book-order";

/**
 * A place on the Book tab's preview where Edit mode can insert a new page: the edge between two of
 * the pages shown (0 the left edge, 1 the gutter, 2 the right edge), and the place in the book's
 * order the new page goes.
 */
export interface InsertPoint {
  edge: 0 | 1 | 2;
  at: number;
}

/**
 * Where a page can be inserted on view, the book's pages and spreads being used in order: at each
 * edge of its two pages that isn't inside a spread, before the page or spread to its right, or after
 * the one to its left when only blank pages or the inside cover are to its right. An edge with no
 * page of the book on either side has none, and two edges that would insert at the same place keep
 * the first.
 */
export function insertPoints(view: BookView, used: BookUnit[]): InsertPoint[] {
  const unitOf = new Map(used.flatMap((unit) => unit.pages.map((page) => [page.id, unit.id])));
  const at = (id: string | undefined) =>
    id === undefined ? -1 : used.findIndex((u) => u.id === id);
  const [left, right] = view.pages.map((page) => unitOf.get(page.id));
  const sides: [string | undefined, string | undefined][] = [
    [undefined, left],
    [left, right],
    [right, undefined],
  ];
  const points: InsertPoint[] = [];
  sides.forEach(([before, after], edge) => {
    if (before !== undefined && before === after) return;
    const place = after !== undefined ? at(after) : before !== undefined ? at(before) + 1 : -1;
    if (place < 0 || points.some((point) => point.at === place)) return;
    points.push({ edge: edge as InsertPoint["edge"], at: place });
  });
  return points;
}

/**
 * The book with a new photo page with layout, made after the other photo pages and put in the book
 * at place at in its order; and the new page's ID.
 */
export function insertNewPage(
  book: PhotoBook,
  layout: PageLayout,
  at: number,
): { book: PhotoBook; id: string } {
  const added = addPage(book, layout);
  const id = added.pages.at(-1)?.id ?? "";
  return { book: addToBook(added, id, at), id };
}

/**
 * The first empty photo place on the pages with IDs ids, such as the ones the preview shows, in
 * that order; null when every one has a photo.
 */
export function firstEmptySlotOn(book: PhotoBook, ids: string[]): SlotPlace | null {
  for (const id of ids) {
    const page = book.pages.findIndex((p) => p.id === id);
    const slot = book.pages[page]?.slots.findIndex((s) => s.photo === "") ?? -1;
    if (slot !== -1) return { page, slot };
  }
  return null;
}
