import { type CatalogPhoto, catalogName } from "@/lib/book-import-prompt";
import { nameFinder, readPastedObject } from "@/lib/pasted-json";
import { type BookPage, LAYOUTS, type PageLayout, type PhotoBook } from "@/lib/photo-book";
import { isObject, textOf } from "@portfolio/lib/values";

/** One photo place of an imported page: the website photo matched to it, or a note on the one that isn't. */
export interface ImportedSlot {
  /** The matched photo file's path, or "" for a printed photo that isn't on the website. */
  photo: string;
  /** The printed caption, when it says more than the caption template would; null otherwise. */
  caption: string | null;
  /** The photo's printed title, or "". */
  printedTitle: string;
  /** What the printed photo shows, when it isn't on the website; or "". */
  description: string;
}

/** One page of the old book as the answer rebuilds it. */
export interface ImportedPage {
  /** The page's number in the old book, or null when the answer didn't say. */
  printed: number | null;
  layout: PageLayout;
  title: string | null;
  slots: ImportedSlot[];
}

/** A photo printed in the old book that isn't on the website. */
export interface MissingPhoto {
  /** The page it's on in the old book, or null when the answer didn't say. */
  page: number | null;
  printedTitle: string;
  description: string;
}

/** A pasted Import Book answer, read and matched to the website's photos. */
export interface BookImport {
  /** The book's suggested name, which the new album and book are named. */
  name: string;
  /** One sentence about the book, for the new album. */
  description: string;
  pages: ImportedPage[];
  /** The printed photos that aren't on the website. */
  missing: MissingPhoto[];
  /** Names in the answer that aren't any website photo's. */
  unknown: string[];
}

/** The layout an ID in the answer names, or else one that holds `photos`. */
function layoutOf(id: unknown, photos: number): PageLayout {
  const known = LAYOUTS.find((layout) => layout.id === id);
  if (known) return known.id;
  return photos <= 1 ? "full" : "pair-left";
}

/** How many photos a layout holds. */
function slotsOf(layout: PageLayout): number {
  return LAYOUTS.find((info) => info.id === layout)?.slots ?? 1;
}

/** A whole page number, or null. */
function pageNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Text from the answer, or null when it's empty or not text. */
function textOrNull(value: unknown): string | null {
  return textOf(value) || null;
}

/** Reads names in the answer as website photos, remembering the ones that aren't any. */
interface Matcher {
  find: (name: string) => CatalogPhoto | undefined;
  unknown: Set<string>;
  used: Set<string>;
}

/** One photo place from the answer, its photo matched to the website's by name. */
function readSlot(value: unknown, match: Matcher): ImportedSlot {
  const entry = isObject(value) ? value : {};
  const name = textOf(entry.photo);
  const found = name ? match.find(name) : undefined;
  if (name && !found) match.unknown.add(name);
  // A photo already placed earlier in the book stays there; a book holds each photo once.
  const photo = found && !match.used.has(found.path) ? found.path : "";
  if (photo) match.used.add(photo);
  return {
    photo,
    caption: textOrNull(entry.caption),
    printedTitle: textOf(entry.printedTitle),
    description: textOf(entry.description),
  };
}

/** A page from the answer, split into pages that follow one another when it has more photos than its layout holds. */
function readPage(value: unknown, match: Matcher): ImportedPage[] {
  const entry = isObject(value) ? value : {};
  const slots = (Array.isArray(entry.photos) ? entry.photos : []).map((s) => readSlot(s, match));
  const layout = layoutOf(entry.layout, slots.length);
  const size = slotsOf(layout);
  const pages: ImportedPage[] = [];
  for (let at = 0; at === 0 || at < slots.length; at += size) {
    pages.push({
      printed: pageNumber(entry.page),
      layout,
      title: at === 0 ? textOrNull(entry.title) : null,
      slots: slots.slice(at, at + size),
    });
  }
  return pages;
}

/** The answer's list of printed photos that aren't on the website. */
function readMissing(value: unknown): MissingPhoto[] {
  return (Array.isArray(value) ? value : []).filter(isObject).map((entry) => ({
    page: pageNumber(entry.page),
    printedTitle: textOf(entry.printedTitle),
    description: textOf(entry.description),
  }));
}

/**
 * Reads a pasted Import Book answer: the book's name, its pages with their layouts and photos
 * matched to `photos` by name (with `matchName`), and the printed photos that aren't on the
 * website. Throws a sentence a user can read when there's no object or no "pages" list.
 */
export function readBookImport(text: string, photos: CatalogPhoto[]): BookImport {
  const answer = readPastedObject(text);
  if (!Array.isArray(answer.pages)) throw new Error(`The answer's JSON has no "pages" list.`);
  const find = nameFinder(photos, (photo) => [catalogName(photo.path), textOf(photo.data.file)]);
  const match: Matcher = { find, unknown: new Set(), used: new Set() };
  const book = isObject(answer.book) ? answer.book : {};
  return {
    name: textOf(book.name),
    description: textOf(book.description),
    pages: answer.pages.flatMap((page) => readPage(page, match)),
    missing: readMissing(answer.notOnWebsite),
    unknown: [...match.unknown],
  };
}

/** The paths of the matched photos, in the order the book shows them. */
export function importedPhotos(read: BookImport): string[] {
  return read.pages.flatMap((page) => page.slots.map((slot) => slot.photo)).filter(Boolean);
}

/** A page of the planner from an imported page, with every place its layout has. */
function bookPage(page: ImportedPage, index: number): BookPage {
  const slots = Array.from({ length: slotsOf(page.layout) }, (_, i) => {
    const slot = page.slots[i];
    return { photo: slot?.photo ?? "", caption: slot?.caption ?? null };
  });
  return { id: `page-${index + 1}`, layout: page.layout, title: page.title, slots };
}

/** The photo book an import makes: its pages as the old book had them, with its photos from album. */
export function importedBook(
  read: BookImport,
  book: { id: string; name: string; album: string },
): PhotoBook {
  return { ...book, template: "", pages: read.pages.map(bookPage) };
}
