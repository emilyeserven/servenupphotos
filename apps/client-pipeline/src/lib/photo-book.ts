/** A built-in page layout: one photo over the page, two down one side, or two portrait photos beside an info column. */
export type BuiltInLayout =
  | "full"
  | "pair-left"
  | "pair-right"
  | "verticals-left"
  | "verticals-right";

/**
 * A page layout of the Photo Book: a built-in one, one made on the book's Layouts tab (its ID starts
 * with `custom-`), `text` for a text page (a title and text, with photos under them if wanted), or
 * `other` for one of the book's other pages, such as one the publisher requires or a bio page,
 * which shows only its name for now.
 */
export type PageLayout = BuiltInLayout | "other" | "text" | `custom-${string}`;

/** The most photos a text page holds. */
export const TEXT_PAGE_PHOTOS = 4;

/**
 * A page layout made on a book's Layouts tab: how many photos the page holds, how they're arranged
 * and shaped, and where the title and captions go.
 */
export interface CustomLayout {
  /** Starts with `custom-`. */
  id: `custom-${string}`;
  /** What the layout buttons call it, such as "Big pair". */
  name: string;
  /** How many photos the page holds, 1 to 4. */
  photos: number;
  /** The photos one under another, or side by side. */
  arrange: "stack" | "row";
  /** Each photo's place: 3:2, 2:3, square, `ratio`'s, or all the room it's given, cropping the photo. */
  shape: "landscape" | "portrait" | "square" | "ratio" | "fill";
  /** The photos' width to height, such as 4 to 5, when shape is `ratio`; absent otherwise. */
  ratio?: { width: number; height: number };
  /** The side the title and captions go on. */
  text: "left" | "right" | "above" | "below";
  /** The title and every caption together on one side, or each caption beside its own photo. */
  captions: "column" | "photo";
  /** The share of the page's width (or height, above or below) the text takes, in percent, 10 to 60. */
  textShare: number;
  /** Where the text sits in its room. */
  align: "start" | "center" | "end";
  /**
   * What align lines the text up with: the edges of the photos as drawn (`photo`), or all the room
   * they're given (`room`, or absent in a layout made before), which can leave space between a
   * photo kept in its shape and the room's edge.
   */
  alignTo?: "room" | "photo";
  /** The room between the photos and the text, in percent of the page's width, 0 to 20. */
  gap: number;
  /** The room around the page's edge, in percent of its width, 0 to 20. */
  margin: number;
  /**
   * What left-hand (even) pages get: the look turned around (`mirror`), their own look (`own`,
   * `left`), or the same look; absent in a layout made before, which is the same.
   */
  leftPages?: "same" | "mirror" | "own";
  /** The look of left-hand pages when leftPages is `own`. */
  left?: VariantLook;
}

/** How a layout draws a page, without what's the same on both sides of the book. */
export type VariantLook = Omit<CustomLayout, "id" | "name" | "photos" | "leftPages" | "left">;

/** Which side of the book a page falls on: left (even page numbers) or right (odd ones). */
export type PageSide = "left" | "right";

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
  /** What the page is called on the Photo Book page, such as "Bicycles, by place"; "" or absent for none. */
  name?: string;
  /**
   * True when the page and the next photo page make a two-page spread, which goes in the book
   * together; absent or false otherwise.
   */
  linkNext?: boolean;
  /** Free-form labels for sorting pages into alternatives, such as "by place"; a spread's are its pages' together. */
  tags?: string[];
  /**
   * The group of alternate pages and spreads the page is in, such as "alt-1", one of which is
   * picked for the book; absent for none. A spread's pages share it.
   */
  alternates?: string;
  /** True on an alternate that lost to the one picked: kept, but not shown on Photo Pages. */
  hidden?: boolean;
  layout: PageLayout;
  /** Shown above the page's top photo; null for none. */
  title: string | null;
  /** A text page's words under its title, in Markdown; absent or "" for none. */
  text?: string;
  /** How many columns a text page's text flows into, 1 to 3; absent for one. */
  columns?: number;
  /** The page's photo places, as many as its layout holds; a text page's, as many as it was given. */
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
  /** The printed book's page size, which sets the shape pages are drawn in; absent for the default. */
  size?: BookSize;
  /** The layouts made on the book's Layouts tab, which its pages can have besides the built-in ones. */
  layouts?: CustomLayout[];
  /** The built-in layouts the book's Photo Pages leave out of their layout pickers. */
  hiddenLayouts?: BuiltInLayout[];
  /** How many pages the printed book should have and can have at most, set on its Info tab. */
  budget?: PageBudget;
}

/** A book's page budget, in printed pages (a spread is two); a number left out isn't set. */
export interface PageBudget {
  /** The number of pages aimed for. */
  target?: number;
  /** The most pages the book can have. */
  max?: number;
}

/** The units a book's page size can be given in. */
export const SIZE_UNITS = ["in", "cm", "mm", "pt", "px"] as const;

/** A book's page size: its width and height, both more than 0, in unit. */
export interface BookSize {
  width: number;
  height: number;
  unit: (typeof SIZE_UNITS)[number];
}

/** BookWright's large landscape page, 12.5 × 10.625 in (900 × 765 pt), the size a book starts with. */
export const DEFAULT_SIZE: BookSize = { width: 12.5, height: 10.625, unit: "in" };

/** The book's pages' width over their height, from its size. */
export function pageAspect(book: Pick<PhotoBook, "size">): number {
  const { width, height } = book.size ?? DEFAULT_SIZE;
  return width > 0 && height > 0 ? width / height : DEFAULT_SIZE.width / DEFAULT_SIZE.height;
}

/** What a page layout is called, how it's described, and how many photos it holds. */
export interface LayoutInfo {
  id: BuiltInLayout;
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
    label: "Two portrait photos, info on the right",
    description:
      "One row: two portrait photos side by side, then a column with the title and both captions.",
    slots: 2,
  },
  {
    id: "verticals-right",
    label: "Two portrait photos, info on the left",
    description:
      "One row: a column with the title and both captions, then two portrait photos side by side.",
    slots: 2,
  },
];

/**
 * How many photos layout holds: a built-in one's count, one of the book's layouts' photos, none on
 * an other page or a new text page, and a full page's one for a layout the book doesn't have.
 */
export function layoutSlots(book: Pick<PhotoBook, "layouts">, layout: PageLayout): number {
  if (layout === "other" || layout === "text") return 0;
  const custom = book.layouts?.find((l) => l.id === layout);
  return custom?.photos ?? LAYOUTS.find((info) => info.id === layout)?.slots ?? 1;
}

/** Whether the page is one of the book's other pages, not a photo page. */
export function isOtherPage(page: BookPage): boolean {
  return page.layout === "other";
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
export function newPage(book: PhotoBook, layout: PageLayout): BookPage {
  const ids = new Set(book.pages.map((page) => page.id));
  let n = book.pages.length + 1;
  while (ids.has(`page-${n}`)) n += 1;
  const page = {
    id: `page-${n}`,
    layout,
    title: null,
    slots: fitSlots([], layoutSlots(book, layout)),
  };
  return layout === "text" ? { ...page, title: "", text: "" } : page;
}

/** The book with the page at index changed by change. */
function changePage(
  book: PhotoBook,
  index: number,
  change: (page: BookPage) => BookPage,
): PhotoBook {
  return { ...book, pages: book.pages.map((page, i) => (i === index ? change(page) : page)) };
}

/** A page's photos as a text page keeps them: its photos without the empty places, up to TEXT_PAGE_PHOTOS. */
function textPageSlots(slots: BookSlot[]): BookSlot[] {
  return slots.filter((slot) => slot.photo !== "").slice(0, TEXT_PAGE_PHOTOS);
}

/**
 * The book with the page at index in a new layout, keeping its photos in order. A photo past the
 * new layout's places comes off the page; a page made a text page keeps up to TEXT_PAGE_PHOTOS.
 */
export function setLayout(book: PhotoBook, index: number, layout: PageLayout): PhotoBook {
  return changePage(book, index, (page) => ({
    ...page,
    layout,
    slots:
      layout === "text"
        ? textPageSlots(page.slots)
        : fitSlots(page.slots, layoutSlots(book, layout)),
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

/** The book with the page at index named name. */
export function renamePage(book: PhotoBook, index: number, name: string): PhotoBook {
  return changePage(book, index, (page) => ({ ...page, name }));
}

/**
 * The paths of every photo on any of the book's pages, in the book or not; with tag, only on the
 * pages tagged with it.
 */
export function photosOnPages(book: PhotoBook, tag?: string | null): Set<string> {
  const pages = tag ? book.pages.filter((page) => page.tags?.includes(tag)) : book.pages;
  return new Set(pages.flatMap((page) => page.slots.map((s) => s.photo)).filter(Boolean));
}

/** The IDs of the pages with the photo at path, in their order on Photo Pages. */
export function pagesWithPhoto(book: PhotoBook, path: string): string[] {
  return book.pages.filter((page) => page.slots.some((s) => s.photo === path)).map((p) => p.id);
}

/** The ID after last among ids, going back to the first after the end or when last isn't there. */
export function nextId(ids: string[], last: string | undefined): string | undefined {
  const at = last === undefined ? -1 : ids.indexOf(last);
  return ids[(at + 1) % ids.length];
}
