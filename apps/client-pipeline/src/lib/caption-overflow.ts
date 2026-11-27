import type { BookPage, BookSlot, PhotoBook } from "@/lib/photo-book";
import { bookSlots } from "@/lib/photo-book-order";

/** The sizes of a caption's box that tell whether its text fits. */
export interface CaptionBox {
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  /** How far its top, right and bottom edges are past its room or the page's printed area, in pixels; 0 or less inside. */
  pastTop: number;
  pastRight: number;
  pastBottom: number;
}

/** Whether a caption overflows: its text is larger than its box, or its box goes past the page's printed area. Rounding is let off by a pixel. */
export function captionOverflows(box: CaptionBox): boolean {
  return (
    box.scrollHeight > box.clientHeight + 1 ||
    box.scrollWidth > box.clientWidth + 1 ||
    box.pastTop > 1 ||
    box.pastRight > 1 ||
    box.pastBottom > 1
  );
}

/** A caption in the book that overflows its room. */
export interface OverflowingCaption {
  /** The ID of the page or spread it's on, to show it. */
  unit: string;
  /** The page's number in the book, and the page. */
  number: number;
  page: BookPage;
  /** The photo file's path, or "" for a caption on an empty place. */
  photo: string;
}

/**
 * The captions in the book, in its order, measured as overflowing their room with the text they
 * have now, from captions by `<page ID>:<slot>` and what each slot's caption says.
 */
export function overflowingCaptions(
  book: PhotoBook,
  captions: Map<string, { text: string; over: boolean }>,
  textOf: (slot: BookSlot) => string,
): OverflowingCaption[] {
  return bookSlots(book).flatMap(({ unit, number, page, slot, key }) => {
    const measured = captions.get(key);
    if (!measured?.over || measured.text !== textOf(slot)) return [];
    return [{ unit, number, page, photo: slot.photo }];
  });
}

/** A box's top, right and bottom edges on the screen. */
interface Edges {
  top: number;
  right: number;
  bottom: number;
}

/** Edges that nothing reaches past, standing in for a room or printed area that isn't known. */
const UNBOUNDED: Edges = { top: -Infinity, right: Infinity, bottom: Infinity };

/**
 * How far the caption text's edges reach past the room its caption is given and the page's printed
 * area (each missing when unknown): positive when past, 0 or less inside.
 */
export function pastEdges(
  text: Edges,
  room: Edges | undefined,
  area: Edges | null,
): Pick<CaptionBox, "pastTop" | "pastRight" | "pastBottom"> {
  const a = area ?? UNBOUNDED;
  const r = room ?? UNBOUNDED;
  return {
    pastTop: Math.max(a.top, r.top) - text.top,
    pastRight: text.right - a.right,
    pastBottom: text.bottom - Math.min(a.bottom, r.bottom),
  };
}
