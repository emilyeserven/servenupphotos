import {
  type BuiltInLayout,
  type CustomLayout,
  LAYOUTS,
  type PageLayout,
  type PhotoBook,
  setLayout,
} from "@/lib/photo-book";
import { count } from "@portfolio/lib/words";

/** Everything about a layout made on the Layouts tab but its ID and name. */
export type LayoutLook = Omit<CustomLayout, "id" | "name">;

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
  if (layout === "other") return null;
  const custom = book.layouts?.find((l) => l.id === layout);
  if (custom) return custom;
  return BUILT_IN_LOOKS[layout as BuiltInLayout] ?? null;
}

/** The book's layout with ID id, if it's one of the book's own. */
export function customLayout(book: PhotoBook, id: string): CustomLayout | undefined {
  return book.layouts?.find((l) => l.id === id);
}

/** What a layout is called, for its buttons: a built-in one's label, or the name it was given. */
export function layoutName(book: PhotoBook, layout: PageLayout): string {
  return (
    LAYOUTS.find((info) => info.id === layout)?.label ?? customLayout(book, layout)?.name ?? layout
  );
}

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

/** Every layout a photo page can have: the built-in ones, then the book's own, oldest first. */
export function layoutChoices(book: PhotoBook): LayoutChoice[] {
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
  const layout: CustomLayout = { ...look, id, name };
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
