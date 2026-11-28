import { type BlurbSizes, type BookCover, DEFAULT_SIZE, type PhotoBook } from "@/lib/photo-book";

/** A cover with every field filled in. */
export type FullCover = Required<BookCover>;

/** The cover a book starts with: Serven Up Photos Vol. 3's, white on black, without its volume. */
export const DEFAULT_COVER: FullCover = {
  title: "Serven\nUp\nPhotos",
  author: "Emily Serven",
  volume: "",
  spine: "",
  background: "#000000",
  color: "#ffffff",
};

/**
 * Blurb's sizes for a Large Landscape (12.5 × 10.625 in) hardcover ImageWrap book of 78 pages on
 * standard paper, which a book starts with.
 */
export const DEFAULT_BLURB: BlurbSizes = {
  pageWidth: 12.625,
  pageHeight: 10.875,
  coverWidth: 26.681,
  coverHeight: 11.625,
  spine: 0.569,
  bleed: 0.306,
};

/** The book's cover, its defaults filling in what it leaves out. */
export function coverOf(book: Pick<PhotoBook, "cover">): FullCover {
  return { ...DEFAULT_COVER, ...book.cover };
}

/** The book with its cover changed. */
export function setCover(book: PhotoBook, change: Partial<BookCover>): PhotoBook {
  return { ...book, cover: { ...coverOf(book), ...change } };
}

/** The book's Blurb sizes, or Blurb's 78-page Large Landscape ones while it has none. */
export function blurbOf(book: Pick<PhotoBook, "blurb">): BlurbSizes {
  return book.blurb ?? DEFAULT_BLURB;
}

/**
 * Whether Blurb's sizes leave room on the cover for its front and back, each more than 0 (the bleed
 * may be 0), as the backend checks on save.
 */
export function validBlurb(sizes: BlurbSizes): boolean {
  const { bleed, spine, coverWidth, coverHeight } = sizes;
  const positive = [sizes.pageWidth, sizes.pageHeight, coverWidth, coverHeight, spine].every(
    (n) => Number.isFinite(n) && n > 0 && n <= 100,
  );
  return positive && bleed >= 0 && spine + 4 * bleed < coverWidth && 2 * bleed < coverHeight;
}

/** The book with its Blurb sizes changed, or unchanged when the change leaves them invalid. */
export function setBlurb(book: PhotoBook, change: Partial<BlurbSizes>): PhotoBook {
  const next = { ...blurbOf(book), ...change };
  return validBlurb(next) ? { ...book, blurb: next } : book;
}

/** A part of the cover's sheet, its edges in percent of the sheet's width and height. */
export interface CoverBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where each part of Blurb's cover sheet is: the back on the left, the spine in the middle and the
 * front on the right, each the sheet's full height, and the front as it's left once Blurb trims
 * the bleed off its top, bottom and outside edge, which the front's words are laid out in.
 */
export function coverParts(
  sizes: BlurbSizes,
): Record<"back" | "spine" | "front" | "frontTrim", CoverBox> {
  const { coverWidth: w, coverHeight: h, spine, bleed } = sizes;
  const x = (inches: number) => (inches / w) * 100;
  const y = (inches: number) => (inches / h) * 100;
  const side = (w - spine) / 2;
  return {
    back: { left: 0, top: 0, width: x(side), height: 100 },
    spine: { left: x(side), top: 0, width: x(spine), height: 100 },
    front: { left: x(side + spine), top: 0, width: x(side), height: 100 },
    frontTrim: {
      left: x(side + spine),
      top: y(bleed),
      width: x(side - bleed),
      height: y(h - 2 * bleed),
    },
  };
}

/** Blurb's safe boundary: how far inside the trimmed edge text should stay, in inches. */
const SAFE_INSET = 0.25;

/**
 * How far the front's words sit from its trimmed edges, in shares of the trimmed front's width, as
 * on Vol. 3's cover; `FrontWords` in `book-cover.tsx` places them by the same numbers.
 */
export const FRONT_INSETS = { title: 0.01, left: 0.08, right: 0.035, bottom: 0.042 };

/** What each of the front's insets is called in a warning. */
const INSET_NAMES: Record<keyof typeof FRONT_INSETS, string> = {
  title: "The title's top",
  left: "The title and author's left edge",
  right: "The volume's right edge",
  bottom: "The author and volume's baseline",
};

/**
 * Warnings for the front's words closer to the trimmed edge than Blurb's safe boundary, each with
 * how close it is. They're only warnings: the cover is drawn as Vol. 3's is either way.
 */
export function coverWarnings(sizes: BlurbSizes): string[] {
  const front = (sizes.coverWidth - sizes.spine) / 2 - sizes.bleed;
  return (Object.keys(FRONT_INSETS) as (keyof typeof FRONT_INSETS)[]).flatMap((edge) => {
    const at = FRONT_INSETS[edge] * front;
    if (at >= SAFE_INSET) return [];
    return [
      `${INSET_NAMES[edge]} is ${inches(at)} from the trimmed edge, inside Blurb's ${inches(SAFE_INSET)} safe boundary, as on Vol. 3.`,
    ];
  });
}

/** A number of inches, as Blurb's specifications write them: up to three decimals, no trailing zeros. */
export function inches(n: number): string {
  return `${Number(n.toFixed(3))} in`;
}

/**
 * What to watch for in **PDF for Blurb**: the bleed isn't drawn, the background just runs to each
 * PDF's edge, so Blurb trims that much off the pages and cover, and anything closer to an edge than
 * Blurb's safe boundary may be cut. The pages' bleed is shown when the book's page size is in
 * inches, from how much larger Blurb's page is.
 */
export function blurbWarnings(book: Pick<PhotoBook, "size" | "blurb">): string[] {
  const sizes = blurbOf(book);
  const size = book.size ?? DEFAULT_SIZE;
  const pageBleed = size.unit === "in" ? (sizes.pageHeight - size.height) / 2 : null;
  const trimmed =
    pageBleed !== null && pageBleed > 0
      ? `about ${inches(pageBleed)} off the top, bottom and outside edge of each page`
      : "the bleed off the top, bottom and outside edge of each page";
  return [
    `Each page is drawn at ${inches(sizes.pageWidth)} × ${inches(sizes.pageHeight)} and the cover at ${inches(sizes.coverWidth)} × ${inches(sizes.coverHeight)}, with no bleed or trim marks drawn: Blurb trims ${trimmed}, and ${inches(sizes.bleed)} off each edge of the cover.`,
    "Keep text and faces at least 0.25 in inside the trimmed edge (0.5 in at the binding), Blurb's safe boundary, or they may be cut.",
  ];
}

/**
 * One PDF **PDF for Blurb** makes: what's drawn for it, its file's name, its count of pages and the
 * size, in inches, each page should measure exactly.
 */
export interface BlurbPdf {
  draw: "pages" | "cover";
  name: string;
  pages: number;
  width: number;
  height: number;
}

/**
 * The PDFs **PDF for Blurb** makes, in order, with its words and tooltip: the pages'
 * (`<id>-blurb-pages.pdf`, printed pages of the book) then the cover's (`<id>-blurb-cover.pdf`, one
 * sheet), or with coverOnly, **Save cover PDF for Blurb**, only the cover's.
 */
export function blurbPdfs(id: string, printed: number, coverOnly: boolean, sizes: BlurbSizes) {
  const cover: BlurbPdf = {
    draw: "cover",
    name: `${id}-blurb-cover.pdf`,
    pages: 1,
    width: sizes.coverWidth,
    height: sizes.coverHeight,
  };
  if (coverOnly) {
    return {
      pdfs: [cover],
      label: "Save cover PDF for Blurb",
      title:
        "Makes the cover's PDF at Blurb's cover size, back, spine and front on one sheet, and downloads it",
    };
  }
  return {
    pdfs: [
      {
        draw: "pages",
        name: `${id}-blurb-pages.pdf`,
        pages: printed,
        width: sizes.pageWidth,
        height: sizes.pageHeight,
      } satisfies BlurbPdf,
      cover,
    ],
    label: "PDF for Blurb",
    title:
      "Makes the two PDFs Blurb takes, the pages at Blurb's page size and the cover at its cover size, and downloads both",
  };
}
