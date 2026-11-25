import {
  type BookPage,
  type PageLayout,
  type PageSide,
  type PhotoBook,
  isOtherPage,
  newPage,
} from "@/lib/photo-book";
import { clamp } from "@portfolio/lib/values";

/**
 * What goes in the book as one: a page on its own, or two photo pages linked into a spread. Its ID
 * is its first page's.
 */
export interface BookUnit {
  id: string;
  /** One page, or a spread's two, left first. */
  pages: BookPage[];
}

/**
 * Every unit made for the book: the photo pages, each linked one with the photo page after it as a
 * spread, then the other pages, each on its own. A page that's the second of a spread can't link
 * on to a third.
 */
export function bookUnits(book: PhotoBook): BookUnit[] {
  const photos = book.pages.filter((page) => !isOtherPage(page));
  const units: BookUnit[] = [];
  for (let i = 0; i < photos.length; i += 1) {
    const page = photos[i] as BookPage;
    const next = photos[i + 1];
    if (page.linkNext && next) {
      units.push({ id: page.id, pages: [page, next] });
      i += 1;
    } else units.push({ id: page.id, pages: [page] });
  }
  const others = book.pages.filter(isOtherPage).map((page) => ({ id: page.id, pages: [page] }));
  return [...units, ...others];
}

/** Each page's unit, by the page's ID. */
function unitsByPage(book: PhotoBook): Map<string, BookUnit> {
  return new Map(bookUnits(book).flatMap((unit) => unit.pages.map((page) => [page.id, unit])));
}

/**
 * The IDs of the units in the book, in its order: `order`, each page listed as its unit, without
 * pages that aren't there or units listed twice; or, in a book made before it had one, every unit.
 */
export function bookOrder(book: PhotoBook): string[] {
  const byPage = unitsByPage(book);
  const ids = book.order ?? book.pages.map((page) => page.id);
  return [...new Set(ids.flatMap((id) => byPage.get(id)?.id ?? []))];
}

/** The units in the book, in its order. */
export function unitsInBook(book: PhotoBook): BookUnit[] {
  const byId = new Map(bookUnits(book).map((unit) => [unit.id, unit]));
  return bookOrder(book).flatMap((id) => byId.get(id) ?? []);
}

/** The pages in the book, in its order, a spread's two together. */
export function bookPages(book: PhotoBook): BookPage[] {
  return unitsInBook(book).flatMap((unit) => unit.pages);
}

/** The book with its order written out, so adding a page doesn't put it in a book made before. */
function withOrder(book: PhotoBook): PhotoBook {
  return { ...book, order: bookOrder(book) };
}

/** The book with the unit with ID id put in it at place at (its end when left out), or moved there. */
export function addToBook(book: PhotoBook, id: string, at?: number): PhotoBook {
  const order = bookOrder(book).filter((other) => other !== id);
  order.splice(at ?? order.length, 0, id);
  return { ...book, order };
}

/** The book without the unit with ID id; its pages stay among the ones that could be used. */
export function takeOutOfBook(book: PhotoBook, id: string): PhotoBook {
  return { ...book, order: bookOrder(book).filter((other) => other !== id) };
}

/** The book with its unit at from, in the book's order, moved to to. */
export function moveInBook(book: PhotoBook, from: number, to: number): PhotoBook {
  const id = bookOrder(book)[from];
  return id === undefined || to < 0 ? book : addToBook(book, id, to);
}

/**
 * The book with a new photo page with layout after the others, not in the book until it's added on
 * the Book tab.
 */
export function addPage(book: PhotoBook, layout: PageLayout): PhotoBook {
  const ordered = withOrder(book);
  return { ...ordered, pages: [...book.pages, newPage(book, layout)] };
}

/** The book with a new other page named name, such as "Bio", added at the end of the book. */
export function addOtherPage(book: PhotoBook, name: string): PhotoBook {
  const page = { ...newPage(book, "other"), name };
  return addToBook({ ...withOrder(book), pages: [...book.pages, page] }, page.id);
}

/**
 * The book with the photo page with ID id linked to the photo page after it as a spread, or
 * unlinked when link is false. A spread already in the book stays in it as one.
 */
export function setLinkNext(book: PhotoBook, id: string, link: boolean): PhotoBook {
  const ordered = withOrder(book);
  const pages = book.pages.map((page) => (page.id === id ? { ...page, linkNext: link } : page));
  return { ...ordered, pages };
}

/** The photo pages and spreads, in their order on Photo Pages. */
function photoUnits(book: PhotoBook): BookUnit[] {
  return bookUnits(book).filter((unit) => !unit.pages.some(isOtherPage));
}

/** The book with its photo pages in units' order, the other pages after them. */
function withPhotoUnits(book: PhotoBook, units: BookUnit[]): PhotoBook {
  const ordered = withOrder(book);
  const pages = [...units.flatMap((unit) => unit.pages), ...book.pages.filter(isOtherPage)];
  return { ...ordered, pages };
}

/**
 * The book with the photo unit at from among the photo pages moved one place earlier (-1) or later
 * (1), so a page can be paired with another one into a spread.
 */
export function movePhotoUnit(book: PhotoBook, from: number, by: -1 | 1): PhotoBook {
  const units = photoUnits(book);
  const to = from + by;
  const [moved] = units.splice(from, 1);
  if (!moved || to < 0 || to > units.length) return book;
  units.splice(to, 0, moved);
  return withPhotoUnits(book, units);
}

/**
 * The book with the photo page or spread with ID id moved before the one with ID before among the
 * photo pages, or to the end with null, a spread's pages together. It doesn't change the book's
 * own order, only Photo Pages'.
 */
export function placePhotoUnit(book: PhotoBook, id: string, before: string | null): PhotoBook {
  const units = photoUnits(book);
  const moved = units.find((unit) => unit.id === id);
  if (!moved || id === before) return book;
  const rest = units.filter((unit) => unit !== moved);
  const at = rest.findIndex((unit) => unit.id === before);
  rest.splice(at < 0 ? rest.length : at, 0, moved);
  return withPhotoUnits(book, rest);
}

/**
 * The book with the photo page or spread with ID id moved to position among the photo pages, 1
 * first, a spread's pages together; a number past either end puts it first or last. Like dragging,
 * it doesn't change the book's own order.
 */
export function movePhotoUnitTo(book: PhotoBook, id: string, position: number): PhotoBook {
  const units = photoUnits(book);
  const from = units.findIndex((unit) => unit.id === id);
  if (from < 0 || !Number.isFinite(position)) return book;
  const to = clamp(Math.round(position) - 1, 0, units.length - 1);
  if (to === from) return book;
  const [moved] = units.splice(from, 1);
  units.splice(to, 0, moved!);
  return withPhotoUnits(book, units);
}

/**
 * The book with its photo pages in the book's order: the ones in the book first, as the Book tab
 * has them, then the rest in the order they were. The book's own order doesn't change.
 */
export function sortByBookOrder(book: PhotoBook): PhotoBook {
  const units = photoUnits(book);
  const place = new Map(bookOrder(book).map((id, at) => [id, at]));
  const rank = (unit: BookUnit) => place.get(unit.id) ?? Number.POSITIVE_INFINITY;
  const sorted = units.toSorted((a, b) => rank(a) - rank(b));
  return sorted.every((unit, at) => unit === units[at]) ? book : withPhotoUnits(book, sorted);
}

/** Each photo page or spread's position among the photo pages, by its ID, 1 first. */
export function photoUnitPositions(book: PhotoBook): Map<string, number> {
  return new Map(photoUnits(book).map((unit, at) => [unit.id, at + 1]));
}

/**
 * The book without the page at index, out of the book's order too. The other page of its spread
 * stays, on its own, in the book where the spread was.
 */
export function removePage(book: PhotoBook, index: number): PhotoBook {
  const gone = book.pages[index];
  if (!gone) return book;
  const unit = unitsByPage(book).get(gone.id);
  const partner = unit?.pages.find((page) => page.id !== gone.id);
  const order = bookOrder(book).flatMap((id) => {
    if (id !== unit?.id) return [id];
    return partner ? [partner.id] : [];
  });
  const pages = book.pages
    .filter((page) => page.id !== gone.id)
    .map((page) => (page.id === unit?.id ? { ...page, linkNext: false } : page));
  return { ...book, pages, order };
}

/** The paths of every photo on the pages in the book. */
export function photosInBook(book: PhotoBook): Set<string> {
  return new Set(
    bookPages(book)
      .flatMap((page) => page.slots.map((s) => s.photo))
      .filter(Boolean),
  );
}

/** Each page's number in the book, 1 first, by its ID; a page not in the book has none. */
export function pageNumbers(book: PhotoBook): Map<string, number> {
  const pages = printedPages(unitsInBook(book));
  return new Map(pages.flatMap((page, i) => (isPlaceholder(page) ? [] : [[page.id, i + 1]])));
}

/** The ID prefix of a blank page the Book tab adds as a placeholder. */
const BLANK_PREFIX = "blank-";
/** The ID prefix of the inside covers the first and last pages face. */
const COVER_PREFIX = "inside-";

/** A placeholder page: drawn on the Book tab, never saved. */
function placeholderPage(id: string, name: string): BookPage {
  return { id, name, layout: "other", title: null, slots: [] };
}

/** Whether the page is one the Book tab adds, not one made for the book: a blank page or an inside cover. */
export function isPlaceholder(page: BookPage): boolean {
  return page.id.startsWith(BLANK_PREFIX) || isInsideCover(page);
}

/** Whether the page is an inside cover, which the first and last pages face; it isn't a page of the book. */
export function isInsideCover(page: BookPage): boolean {
  return page.id.startsWith(COVER_PREFIX);
}

/**
 * The printed book's pages in order, page 1 first (a right page, so odd pages are right and even
 * ones left): the units' pages, with a blank placeholder before a spread that would start on a
 * right page, so it opens left and right, and one at the end when the count is odd, as a printed
 * book has an even number of pages.
 */
export function printedPages(units: BookUnit[]): BookPage[] {
  const pages: BookPage[] = [];
  const blank = () =>
    pages.push(placeholderPage(`${BLANK_PREFIX}${pages.length + 1}`, "Blank page"));
  for (const unit of units) {
    if (unit.pages.length > 1 && pages.length % 2 === 0) blank();
    pages.push(...unit.pages);
  }
  if (pages.length % 2 === 1) blank();
  return pages;
}

/** For each photo on more than one page in the book, the numbers of those pages. */
export function repeatedPhotos(book: PhotoBook): Map<string, number[]> {
  const pages = new Map<string, number[]>();
  const numbers = pageNumbers(book);
  for (const page of bookPages(book)) {
    for (const { photo } of page.slots) {
      if (photo) pages.set(photo, [...(pages.get(photo) ?? []), numbers.get(page.id) ?? 0]);
    }
  }
  return new Map([...pages].filter(([, on]) => on.length > 1));
}

/** What the book's preview shows at once: two pages facing each other as the book opens. */
export interface BookView {
  /** The IDs of the units on it, left first. */
  units: string[];
  /** Its two pages, left first, placeholders among them. */
  pages: BookPage[];
}

/**
 * The book as it opens, two facing pages at a time: page 1 on the right facing the inside front
 * cover, then each even page on the left facing the one after it, the last page facing the inside
 * back cover. A spread is always on one view, with a blank page before it when needed.
 */
export function bookViews(units: BookUnit[]): BookView[] {
  const pages = printedPages(units);
  if (pages.length === 0) return [];
  const sides = [
    placeholderPage(`${COVER_PREFIX}front`, "Inside front cover"),
    ...pages,
    placeholderPage(`${COVER_PREFIX}back`, "Inside back cover"),
  ];
  const unitOf = new Map(units.flatMap((unit) => unit.pages.map((page) => [page.id, unit.id])));
  const views: BookView[] = [];
  for (let i = 0; i < sides.length; i += 2) {
    const two = sides.slice(i, i + 2);
    views.push({
      pages: two,
      units: [...new Set(two.flatMap((page) => unitOf.get(page.id) ?? []))],
    });
  }
  return views;
}

/** Where the unit with ID id is shown among views, or 0 when it isn't. */
export function viewOf(views: BookView[], id: string): number {
  return Math.max(
    0,
    views.findIndex((view) => view.units.includes(id)),
  );
}

/** The book with the unit with ID id put in it just before the unit with ID before, or at its end. */
export function addToBookBefore(book: PhotoBook, id: string, before: string | null): PhotoBook {
  const rest = bookOrder(book).filter((other) => other !== id);
  const at = before === null ? -1 : rest.indexOf(before);
  return addToBook(book, id, at < 0 ? rest.length : at);
}

/** The unit's tags: its pages' together, each once, in the order they were added. */
export function unitTags(unit: BookUnit): string[] {
  return [...new Set(unit.pages.flatMap((page) => page.tags ?? []))];
}

/** The book with change made to each page whose ID is in ids, its order written out. */
export function changePages(
  book: PhotoBook,
  ids: Set<string>,
  change: (page: BookPage) => BookPage,
): PhotoBook {
  return {
    ...withOrder(book),
    pages: book.pages.map((page) => (ids.has(page.id) ? change(page) : page)),
  };
}

/** The book with the unit with ID id tagged tags, on each of its pages, trimmed, each once. */
export function setUnitTags(book: PhotoBook, id: string, tags: string[]): PhotoBook {
  const unit = bookUnits(book).find((u) => u.id === id);
  if (!unit) return book;
  const clean = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return changePages(book, new Set(unit.pages.map((page) => page.id)), (page) => ({
    ...page,
    tags: clean,
  }));
}

/** Every tag on the book's pages, in alphabetical order. */
export function bookTags(book: PhotoBook): string[] {
  return [...new Set(book.pages.flatMap((page) => page.tags ?? []))].toSorted((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * The units tagged tag, and the tag the filter is on: none (every unit) when tag is null or no
 * longer on any page of the book, whose tags are tags.
 */
export function unitsTagged(
  units: BookUnit[],
  tags: string[],
  tag: string | null,
): { filter: string | null; shown: BookUnit[] } {
  if (tag === null || !tags.includes(tag)) return { filter: null, shown: units };
  return { filter: tag, shown: units.filter((unit) => unitTags(unit).includes(tag)) };
}

/**
 * The side of the book each page falls on, by its ID: in the book, left for an even page number
 * and right for an odd one, as a printed book opens; not in it, a spread's first page on the left
 * and its second on the right, and a page on its own on the right.
 */
export function pageSides(book: PhotoBook): Map<string, PageSide> {
  const sides = new Map<string, PageSide>();
  for (const unit of bookUnits(book)) {
    unit.pages.forEach((page, i) => {
      sides.set(page.id, unit.pages.length > 1 && i === 0 ? "left" : "right");
    });
  }
  for (const [id, number] of pageNumbers(book)) sides.set(id, number % 2 === 0 ? "left" : "right");
  return sides;
}
