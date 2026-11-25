/**
 * A page layout of the Photo Book: one photo over the page, two down one side, or two portrait
 * photos side by side on one side.
 */
export type PageLayout = "full" | "pair-left" | "pair-right" | "verticals-left" | "verticals-right";

/** One photo's place on a page, with its caption. */
export interface BookSlot {
  /** The photo file's path, or "" while the place is empty. */
  photo: string;
  /** A caption written by hand; null to fill it in from the photo with the book's caption template. */
  caption: string | null;
}

/** One page of a photo book. */
export interface BookPage {
  /** Tells the page from the others in its book. */
  id: string;
  layout: PageLayout;
  /** Shown above the page's top photo; null for none. */
  title: string | null;
  /** The page's photo places, as many as its layout holds. */
  slots: BookSlot[];
}

/**
 * A photo book file: a rough mockup of a photo book's pages, made on the Photo Book page to plan one
 * before laying it out for real. Commit combines them into PHOTOBOOKS.json.
 */
export interface PhotoBook {
  /** Made from the name when the book is made, and kept after that. */
  id: string;
  /** How the Photo Book page lists it, such as "Korea 2026". */
  name: string;
  /** The caption template its captions are filled in with, by ID; "" for the default one. */
  template: string;
  /** The ID of the album the book's photos come from; absent or "" while none is picked. */
  album?: string;
  /**
   * Every page made for the book on its Pages tab, ones that could be used, newest last; the book
   * itself is the ones `order` lists.
   */
  pages: BookPage[];
  /**
   * The IDs of the pages that will be used, in the book's order, set on its Book tab; absent in a
   * book made before, whose pages are then all in it, in their order.
   */
  order?: string[];
}

/** What a page layout is called, how it's described, and how many photos it holds. */
export interface LayoutInfo {
  id: PageLayout;
  label: string;
  description: string;
  slots: number;
}

/** Every page layout, in the order the Add page picker lists them. */
export const LAYOUTS: LayoutInfo[] = [
  {
    id: "full",
    label: "Full page",
    description: "One photo over the page, its caption at the bottom.",
    slots: 1,
  },
  {
    id: "pair-left",
    label: "Two photos on the left",
    description: "Two photos down the left side, each caption beside its photo.",
    slots: 2,
  },
  {
    id: "pair-right",
    label: "Two photos on the right",
    description: "Two photos down the right side, each caption beside its photo.",
    slots: 2,
  },
  {
    id: "verticals-left",
    label: "Two portrait photos on the left",
    description: "Two portrait photos side by side on the left, their captions on the right.",
    slots: 2,
  },
  {
    id: "verticals-right",
    label: "Two portrait photos on the right",
    description: "Two portrait photos side by side on the right, their captions on the left.",
    slots: 2,
  },
];

/** The layout's info; a full page's for a layout the page doesn't know. */
function layoutInfo(layout: PageLayout): LayoutInfo {
  return LAYOUTS.find((info) => info.id === layout) ?? (LAYOUTS[0] as LayoutInfo);
}

/** Where a photo goes: a page, by its place in the book, and a slot on it. */
export interface SlotPlace {
  page: number;
  slot: number;
}

const EMPTY_SLOT: BookSlot = { photo: "", caption: null };

/** slots cut or filled with empty ones to count. */
function fitSlots(slots: BookSlot[], count: number): BookSlot[] {
  return Array.from({ length: count }, (_, i) => slots[i] ?? EMPTY_SLOT);
}

/** A new page with layout and no photos, with an ID none of the book's pages has. */
function newPage(book: PhotoBook, layout: PageLayout): BookPage {
  const ids = new Set(book.pages.map((page) => page.id));
  let n = book.pages.length + 1;
  while (ids.has(`page-${n}`)) n += 1;
  return { id: `page-${n}`, layout, title: null, slots: fitSlots([], layoutInfo(layout).slots) };
}

/**
 * The book with a new page with layout after the other pages that could be used, not in the book
 * until it's added on the Book tab.
 */
export function addPage(book: PhotoBook, layout: PageLayout): PhotoBook {
  return { ...book, pages: [...book.pages, newPage(book, layout)], order: bookOrder(book) };
}

/** The book with the page at index changed by change. */
function changePage(
  book: PhotoBook,
  index: number,
  change: (page: BookPage) => BookPage,
): PhotoBook {
  return { ...book, pages: book.pages.map((page, i) => (i === index ? change(page) : page)) };
}

/**
 * The book with the page at index in a new layout, keeping its photos in order. A photo past the
 * new layout's places comes off the page.
 */
export function setLayout(book: PhotoBook, index: number, layout: PageLayout): PhotoBook {
  return changePage(book, index, (page) => ({
    ...page,
    layout,
    slots: fitSlots(page.slots, layoutInfo(layout).slots),
  }));
}

/** The book with the page at index titled title, or without a title when it's null. */
export function setTitle(book: PhotoBook, index: number, title: string | null): PhotoBook {
  return changePage(book, index, (page) => ({ ...page, title }));
}

/** The book with the slot at place changed by change. */
function changeSlot(
  book: PhotoBook,
  { page, slot }: SlotPlace,
  change: (slot: BookSlot) => BookSlot,
): PhotoBook {
  return changePage(book, page, (p) => ({
    ...p,
    slots: p.slots.map((s, i) => (i === slot ? change(s) : s)),
  }));
}

/** The book with the caption at place written by hand, or filled in from the template when null. */
export function setCaption(book: PhotoBook, place: SlotPlace, caption: string | null): PhotoBook {
  return changeSlot(book, place, (slot) => ({ ...slot, caption }));
}

/**
 * The book with the photo at path put at place. One dragged from another place on the pages (from)
 * moves there with its caption, swapping with whatever was there; one from the drawer goes in with
 * its caption from the template, and the photo it takes the place of comes off that page. A photo
 * can be on more than one page, such as two pages that try it out two ways.
 */
export function placePhoto(
  book: PhotoBook,
  place: SlotPlace,
  path: string,
  from?: SlotPlace,
): PhotoBook {
  const target = book.pages[place.page]?.slots[place.slot];
  if (!target) return book;
  const moving = from && book.pages[from.page]?.slots[from.slot];
  if (!from || moving?.photo !== path) {
    return changeSlot(book, place, () => ({ photo: path, caption: null }));
  }
  return changeSlot(
    changeSlot(book, from, () => target),
    place,
    () => moving,
  );
}

/** The book with the photo at place taken off, leaving its place empty. */
export function removePhoto(book: PhotoBook, place: SlotPlace): PhotoBook {
  return changeSlot(book, place, () => EMPTY_SLOT);
}

/** The first empty photo place on any of the pages, first page first; null when every one has a photo. */
export function firstEmptySlot(book: PhotoBook): SlotPlace | null {
  for (const [page, p] of book.pages.entries()) {
    const slot = p.slots.findIndex((s) => s.photo === "");
    if (slot !== -1) return { page, slot };
  }
  return null;
}

/**
 * The IDs of the pages in the book, in its order: `order` without IDs of pages that aren't there or
 * are listed twice, or, in a book made before it had one, every page.
 */
export function bookOrder(book: PhotoBook): string[] {
  const ids = new Set(book.pages.map((page) => page.id));
  if (!book.order) return [...ids];
  return [...new Set(book.order)].filter((id) => ids.has(id));
}

/** The pages in the book, in its order. */
export function bookPages(book: PhotoBook): BookPage[] {
  const byId = new Map(book.pages.map((page) => [page.id, page]));
  return bookOrder(book).flatMap((id) => byId.get(id) ?? []);
}

/** The book with the page with ID id added at its end, unless it's in it already. */
export function addToBook(book: PhotoBook, id: string): PhotoBook {
  const order = bookOrder(book);
  return order.includes(id) ? book : { ...book, order: [...order, id] };
}

/** The book without the page with ID id; the page stays among the pages that could be used. */
export function takeOutOfBook(book: PhotoBook, id: string): PhotoBook {
  return { ...book, order: bookOrder(book).filter((other) => other !== id) };
}

/** The book with its page at from, in the book's order, moved to to. */
export function moveInBook(book: PhotoBook, from: number, to: number): PhotoBook {
  const order = bookOrder(book);
  const [moved] = order.splice(from, 1);
  if (moved === undefined || to < 0 || to > order.length) return book;
  order.splice(to, 0, moved);
  return { ...book, order };
}

/** The book without the page at index, taken out of the book's order too. */
export function removePage(book: PhotoBook, index: number): PhotoBook {
  const id = book.pages[index]?.id;
  const pages = book.pages.filter((_, i) => i !== index);
  return { ...book, pages, order: bookOrder(book).filter((other) => other !== id) };
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
  return new Map(bookOrder(book).map((id, i) => [id, i + 1]));
}

/** For each photo on more than one page in the book, the numbers of those pages. */
export function repeatedPhotos(book: PhotoBook): Map<string, number[]> {
  const pages = new Map<string, number[]>();
  for (const [i, page] of bookPages(book).entries()) {
    for (const { photo } of page.slots) {
      if (photo) pages.set(photo, [...(pages.get(photo) ?? []), i + 1]);
    }
  }
  return new Map([...pages].filter(([, on]) => on.length > 1));
}
