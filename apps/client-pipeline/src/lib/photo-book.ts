/** A page layout of the Photo Book: one photo over the page, or two down one side. */
export type PageLayout = "full" | "pair-left" | "pair-right";

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
  /** The pages, first to last. */
  pages: BookPage[];
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

/** The book with a new page with layout at the end. */
export function addPage(book: PhotoBook, layout: PageLayout): PhotoBook {
  return { ...book, pages: [...book.pages, newPage(book, layout)] };
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

/** Where the photo at path is in the book; null when it's in none of its pages. */
function findPhoto(book: PhotoBook, path: string): SlotPlace | null {
  for (const [page, p] of book.pages.entries()) {
    const slot = p.slots.findIndex((s) => s.photo === path);
    if (slot !== -1) return { page, slot };
  }
  return null;
}

/**
 * The book with the photo at path put at place. A photo already in the book moves there, with its
 * caption, swapping with whatever was there; a new one goes in with its caption from the template,
 * and the photo it takes the place of comes off the book.
 */
export function placePhoto(book: PhotoBook, place: SlotPlace, path: string): PhotoBook {
  const from = findPhoto(book, path);
  const target = book.pages[place.page]?.slots[place.slot];
  if (!target) return book;
  if (from === null) return changeSlot(book, place, () => ({ photo: path, caption: null }));
  const moving = book.pages[from.page]?.slots[from.slot] ?? EMPTY_SLOT;
  return changeSlot(
    changeSlot(book, from, () => target),
    place,
    () => moving,
  );
}

/** The book without the photo at path, leaving its place empty. */
export function removePhoto(book: PhotoBook, path: string): PhotoBook {
  const from = findPhoto(book, path);
  return from === null ? book : changeSlot(book, from, () => EMPTY_SLOT);
}

/** The first empty photo place in the book, first page first; null when every one has a photo. */
export function firstEmptySlot(book: PhotoBook): SlotPlace | null {
  for (const [page, p] of book.pages.entries()) {
    const slot = p.slots.findIndex((s) => s.photo === "");
    if (slot !== -1) return { page, slot };
  }
  return null;
}

/** The book with the page at from moved to to. */
export function movePage(book: PhotoBook, from: number, to: number): PhotoBook {
  const pages = [...book.pages];
  const [moved] = pages.splice(from, 1);
  if (!moved || to < 0 || to > pages.length) return book;
  pages.splice(to, 0, moved);
  return { ...book, pages };
}

/** The book without the page at index. */
export function removePage(book: PhotoBook, index: number): PhotoBook {
  return { ...book, pages: book.pages.filter((_, i) => i !== index) };
}

/** The paths of every photo in the book. */
export function photosInBook(book: PhotoBook): Set<string> {
  return new Set(book.pages.flatMap((page) => page.slots.map((s) => s.photo)).filter(Boolean));
}
