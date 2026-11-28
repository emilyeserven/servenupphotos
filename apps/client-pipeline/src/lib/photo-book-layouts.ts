import {
  type BuiltInLayout,
  type CustomLayout,
  LAYOUTS,
  type PageLayout,
  type PageSide,
  type PhotoBook,
  setLayout,
} from "@/lib/photo-book";
import { mirrorMargins } from "@/lib/photo-book-margins";
import { count } from "@portfolio/lib/words";

/** Everything about a layout made on the Layouts tab but its ID and name. */
export type LayoutLook = Omit<CustomLayout, "id" | "name" | "leftPages" | "left">;

/** The built-in layouts as Layouts tab settings, so Customize starts a new layout from one of them. */
export const BUILT_IN_LOOKS: Record<BuiltInLayout, LayoutLook> = {
  full: {
    photos: 1,
    arrange: "stack",
    shape: "landscape",
    text: "below",
    captions: "photo",
    textShare: 18,
    align: "center",
    gap: 3,
    margin: 0,
  },
  "pair-left": {
    photos: 2,
    arrange: "stack",
    shape: "landscape",
    text: "right",
    captions: "photo",
    textShare: 37,
    align: "start",
    gap: 3,
    margin: 0,
  },
  "pair-right": {
    photos: 2,
    arrange: "stack",
    shape: "landscape",
    text: "left",
    captions: "photo",
    textShare: 37,
    align: "start",
    gap: 3,
    margin: 0,
  },
  "verticals-left": {
    photos: 2,
    arrange: "row",
    shape: "portrait",
    text: "right",
    captions: "column",
    textShare: 26,
    align: "center",
    gap: 2,
    margin: 0,
  },
  "verticals-right": {
    photos: 2,
    arrange: "row",
    shape: "portrait",
    text: "left",
    captions: "column",
    textShare: 26,
    align: "center",
    gap: 2,
    margin: 0,
  },
};

/** The settings of layout, built in or one of the book's; null for an other page's or one it doesn't have. */
function layoutLook(book: PhotoBook, layout: PageLayout): LayoutLook | null {
  if (layout === "other" || layout === "text") return null;
  const custom = book.layouts?.find((l) => l.id === layout);
  if (custom) return custom;
  return BUILT_IN_LOOKS[layout as BuiltInLayout] ?? null;
}

/**
 * Where a layout puts the page's title: as it says, or, in a layout made before that doesn't, with
 * the captions when they're in one column and across the top when each is beside its photo.
 */
export function titlePlace(look: Pick<LayoutLook, "title" | "captions">): "text" | "top" | "off" {
  return look.title ?? (look.captions === "column" ? "text" : "top");
}

/** The book's layout with ID id, if it's one of the book's own. */
export function customLayout(book: PhotoBook, id: string): CustomLayout | undefined {
  return book.layouts?.find((l) => l.id === id);
}

/** What a layout is called, for its buttons: a built-in one's label, or the name it was given. */
export function layoutName(book: PhotoBook, layout: PageLayout): string {
  if (layout === "text") return TEXT_CHOICE.label;
  return (
    LAYOUTS.find((info) => info.id === layout)?.label ?? customLayout(book, layout)?.name ?? layout
  );
}

/**
 * A text page, as the layout pickers offer it after the built-in layouts: a title and text, with
 * photos under them if wanted. Its look only draws its glyph.
 */
const TEXT_CHOICE: LayoutChoice = {
  id: "text",
  label: "Text page",
  description: "A title and text in Markdown, in up to 3 columns, with up to 4 photos under it.",
  look: {
    photos: 2,
    arrange: "row",
    shape: "fill",
    text: "above",
    captions: "column",
    textShare: 60,
    align: "start",
    gap: 2,
    margin: 0,
  },
};

/** A layout a photo page can have, as its buttons show it. */
export interface LayoutChoice {
  id: PageLayout;
  label: string;
  description: string;
  /** Its settings, which draw its glyph. */
  look: LayoutLook;
}

/** What each photo shape is called in a layout's description. */
const SHAPE_WORDS: Record<LayoutLook["shape"], string> = {
  landscape: "3:2",
  portrait: "2:3",
  square: "square",
  ratio: "custom ratio",
  fill: "filling their room",
};

/** A layout's settings in a sentence, such as "2 photos in a row, 2:3, text on the left." */
function describeLook(look: LayoutLook): string {
  const photos = count(look.photos, "photo");
  const arrange = look.photos === 1 ? "" : look.arrange === "row" ? " in a row" : " stacked";
  const captions = look.captions === "photo" ? ", each caption beside its photo" : "";
  const side = look.text === "above" || look.text === "below" ? look.text : `on the ${look.text}`;
  const shape =
    look.shape === "ratio" && look.ratio
      ? `${look.ratio.width}:${look.ratio.height}`
      : SHAPE_WORDS[look.shape];
  return `${photos}${arrange}, ${shape}, text ${side}${captions}.`;
}

/** Every layout a page can have, hidden built-in ones too: the built-in ones, then the book's own. */
export function everyLayoutChoice(book: PhotoBook): LayoutChoice[] {
  return [
    ...LAYOUTS.map((info) => ({ ...info, look: BUILT_IN_LOOKS[info.id] })),
    ...(book.layouts ?? []).map((l) => ({
      id: l.id,
      label: l.name,
      description: describeLook(l),
      look: l,
    })),
  ];
}

/**
 * The layouts a page's picker offers: every one but the built-in ones the book hides, though a
 * page keeps its current one: the built-in ones, a text page, then the book's own.
 */
export function layoutChoices(book: PhotoBook, current?: PageLayout): LayoutChoice[] {
  const hidden = new Set<PageLayout>(book.hiddenLayouts ?? []);
  const choices = everyLayoutChoice(book).filter((c) => !hidden.has(c.id) || c.id === current);
  const own = choices.filter((c) => c.id.startsWith("custom-"));
  return [...choices.filter((c) => !own.includes(c)), TEXT_CHOICE, ...own];
}

/**
 * The book with a new layout named name, its settings copied from from (a built-in layout or one
 * of the book's), and the new layout's ID.
 */
export function addLayout(
  book: PhotoBook,
  from: PageLayout,
  name: string,
): { book: PhotoBook; id: CustomLayout["id"] } {
  const ids = new Set((book.layouts ?? []).map((l) => l.id));
  let n = (book.layouts?.length ?? 0) + 1;
  while (ids.has(`custom-${n}`)) n += 1;
  const id = `custom-${n}` as const;
  const look = layoutLook(book, from) ?? BUILT_IN_LOOKS.full;
  const layout: CustomLayout = { ...look, id, name, leftPages: "mirror" };
  return { book: { ...book, layouts: [...(book.layouts ?? []), layout] }, id };
}

/** The indexes of the pages with layout. */
function pagesWith(book: PhotoBook, layout: string): number[] {
  return book.pages.flatMap((page, i) => (page.layout === layout ? [i] : []));
}

/** How many pages have layout. */
export function pagesUsing(book: PhotoBook, layout: string): number {
  return pagesWith(book, layout).length;
}

/**
 * The book with its layout with ID id changed by change. When the layout holds fewer photos now,
 * a photo past its places comes off the pages that have it.
 */
export function changeLayout(
  book: PhotoBook,
  id: string,
  change: Partial<Omit<CustomLayout, "id">>,
): PhotoBook {
  const layouts = (book.layouts ?? []).map((l) => (l.id === id ? { ...l, ...change } : l));
  const changed: PhotoBook = { ...book, layouts };
  return pagesWith(changed, id).reduce<PhotoBook>(
    (b, index) => setLayout(b, index, id as PageLayout),
    changed,
  );
}

/** The book without its layout with ID id; the pages that had it become full pages. */
export function removeLayout(book: PhotoBook, id: string): PhotoBook {
  const full = pagesWith(book, id).reduce<PhotoBook>(
    (b, index) => setLayout(b, index, "full"),
    book,
  );
  return { ...full, layouts: (book.layouts ?? []).filter((l) => l.id !== id) };
}

/** Whether the layout's text goes beside its photos (left or right), not above or below them. */
export function textBeside(look: Pick<LayoutLook, "text">): boolean {
  return look.text === "left" || look.text === "right";
}

/** Whether the layout's text comes before its photos: on the left or above them. */
export function textFirst(look: Pick<LayoutLook, "text">): boolean {
  return look.text === "left" || look.text === "above";
}

/** Each kept photo shape's width over its height. */
const SHAPE_RATIOS: Record<"landscape" | "portrait" | "square", number> = {
  landscape: 3 / 2,
  portrait: 2 / 3,
  square: 1,
};

/**
 * The shape the layout's photo places keep, as their width over their height, or `fill` for all
 * the room they're given. A ratio without both sides more than 0 is square.
 */
export function photoShape(look: Pick<LayoutLook, "shape" | "ratio">): number | "fill" {
  if (look.shape === "fill") return "fill";
  if (look.shape !== "ratio") return SHAPE_RATIOS[look.shape];
  const { width = 0, height = 0 } = look.ratio ?? {};
  return width > 0 && height > 0 ? width / height : 1;
}

/**
 * The look turned around for the other side of the book: text on the left goes on the right, and
 * so does the left print offset.
 */
function mirrorLook<
  T extends Pick<LayoutLook, "text" | "margin" | "printOffsetLeft" | "printOffsetRight">,
>(look: T): T {
  const turned = { left: "right", right: "left", above: "above", below: "below" } as const;
  return mirrorMargins({ ...look, text: turned[look.text] });
}

/** How layout draws a page on side: its look on the right, or what it gives left-hand pages. */
export function sideLook(layout: CustomLayout, side: PageSide): LayoutLook {
  const { id: _id, name: _name, leftPages, left, ...look } = layout;
  if (side === "right" || !leftPages || leftPages === "same") return look;
  if (leftPages === "own" && left) return { ...left, photos: look.photos };
  return mirrorLook(look);
}

/**
 * The book with layout's left-hand pages set to what: the same look, mirrored, or their own,
 * which starts as the mirrored look when the layout had none.
 */
export function setLeftPages(
  book: PhotoBook,
  id: string,
  what: NonNullable<CustomLayout["leftPages"]>,
): PhotoBook {
  const layout = customLayout(book, id);
  if (!layout) return book;
  if (what !== "own" || layout.left) return changeLayout(book, id, { leftPages: what });
  const { photos: _photos, ...mirrored } = sideLook({ ...layout, leftPages: "mirror" }, "left");
  return changeLayout(book, id, { leftPages: what, left: mirrored });
}

/** The book with the built-in layout id hidden from its Photo Pages' pickers, or shown again. */
export function setHidden(book: PhotoBook, id: BuiltInLayout, hide: boolean): PhotoBook {
  const rest = (book.hiddenLayouts ?? []).filter((other) => other !== id);
  return { ...book, hiddenLayouts: hide ? [...rest, id] : rest };
}

/**
 * The book with change made to its layout with ID id as drawn on side: on the left, when left-hand
 * pages have their own settings, it changes those, except how many photos, which both sides share.
 */
export function changeSide(
  book: PhotoBook,
  id: string,
  side: PageSide,
  change: Partial<LayoutLook>,
): PhotoBook {
  const layout = customLayout(book, id);
  if (side === "right" || layout?.leftPages !== "own" || !layout.left) {
    return changeLayout(book, id, change);
  }
  const { photos, ...rest } = change;
  return changeLayout(book, id, {
    ...(photos === undefined ? {} : { photos }),
    left: { ...layout.left, ...rest },
  });
}

/**
 * How a page with one of the book's own layouts is drawn: its layout's look for the page's side,
 * which side gives when set and else sides, a right-hand page when neither knows; undefined for a
 * page with a built-in layout.
 */
export function customPageLook(
  layouts: CustomLayout[],
  page: { id: string; layout: PageLayout },
  sides: Map<string, PageSide>,
  side?: PageSide,
): LayoutLook | undefined {
  const custom = layouts.find((l) => l.id === page.layout);
  return custom && sideLook(custom, side ?? sides.get(page.id) ?? "right");
}
