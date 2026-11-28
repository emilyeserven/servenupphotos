import type { LayoutLook } from "@/lib/photo-book-layouts";

/** The margin settings of a layout made on the Layouts tab. */
type MarginLook = Pick<LayoutLook, "margin" | "marginLeft" | "marginRight">;

/** True when the layout's left and right margins are set apart from the margin all round. */
export function marginsApart(look: MarginLook): boolean {
  return look.marginLeft !== undefined || look.marginRight !== undefined;
}

/**
 * The room the layout leaves at the page's top, right, bottom and left edges, in percent of the
 * page's width: the margin all round, with the left and right margins in place of it where set.
 */
export function pageMargins(look: MarginLook): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const { margin } = look;
  return {
    top: margin,
    right: look.marginRight ?? margin,
    bottom: margin,
    left: look.marginLeft ?? margin,
  };
}

/** The CSS padding a page with the layout gets for its margins, in `cqw`. */
export function marginPadding(look: MarginLook): string {
  const { top, right, bottom, left } = pageMargins(look);
  return `${top}cqw ${right}cqw ${bottom}cqw ${left}cqw`;
}

/**
 * The change that sets the layout's left and right margins apart from the margin all round,
 * both starting at it, or puts them back to the margin all round.
 */
export function setMarginsApart(look: MarginLook, apart: boolean): Partial<MarginLook> {
  return apart
    ? { marginLeft: look.margin, marginRight: look.margin }
    : { marginLeft: undefined, marginRight: undefined };
}

/** The margins turned around for the other side of the book: the left margin goes on the right. */
export function mirrorMargins<T extends MarginLook>(look: T): T {
  if (!marginsApart(look)) return look;
  const { marginLeft, marginRight, ...rest } = look;
  return {
    ...rest,
    ...(marginRight === undefined ? {} : { marginLeft: marginRight }),
    ...(marginLeft === undefined ? {} : { marginRight: marginLeft }),
  } as T;
}
