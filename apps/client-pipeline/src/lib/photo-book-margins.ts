import type { LayoutLook } from "@/lib/photo-book-layouts";

/** The margin settings of a layout made on the Layouts tab. */
type MarginLook = Pick<LayoutLook, "margin" | "printOffsetLeft" | "printOffsetRight">;

/**
 * The room the layout leaves at the page's top, right, bottom and left edges, in percent of the
 * page's width: the margin all round, plus the print offsets at the left and right when the page
 * is printed for Blurb (print true).
 */
export function pageMargins(
  look: MarginLook,
  print: boolean,
): { top: number; right: number; bottom: number; left: number } {
  const { margin } = look;
  return {
    top: margin,
    right: margin + (print ? (look.printOffsetRight ?? 0) : 0),
    bottom: margin,
    left: margin + (print ? (look.printOffsetLeft ?? 0) : 0),
  };
}

/** The CSS padding a page with the layout gets for its margins, in `cqw`, with the print offsets when print is true. */
export function marginPadding(look: MarginLook, print: boolean): string {
  const { top, right, bottom, left } = pageMargins(look, print);
  return `${top}cqw ${right}cqw ${bottom}cqw ${left}cqw`;
}

/** The print offsets turned around for the other side of the book: the left one goes on the right. */
export function mirrorMargins<T extends MarginLook>(look: T): T {
  const { printOffsetLeft, printOffsetRight, ...rest } = look;
  return {
    ...rest,
    ...(printOffsetRight === undefined ? {} : { printOffsetLeft: printOffsetRight }),
    ...(printOffsetLeft === undefined ? {} : { printOffsetRight: printOffsetLeft }),
  } as T;
}
