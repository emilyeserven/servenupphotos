import type { PageLayout, PhotoBook } from "@/lib/photo-book";
import { everyLayoutChoice } from "@/lib/photo-book-layouts";
import type { BookUnit } from "@/lib/photo-book-order";

/** A layout to filter pages by: its ID and what it's called. */
export interface LayoutOption {
  id: PageLayout;
  label: string;
}

/**
 * The layouts the pages and spreads use, to filter them by: the built-in ones, then the book's
 * own, in the order the pickers list them, then **Text pages** and **Other pages** when there are any. A spread
 * counts for each of its pages' layouts.
 */
export function unitLayouts(book: PhotoBook, units: BookUnit[]): LayoutOption[] {
  const used = new Set(units.flatMap((unit) => unit.pages.map((page) => page.layout)));
  const options: LayoutOption[] = everyLayoutChoice(book)
    .filter((choice) => used.has(choice.id))
    .map(({ id, label }) => ({ id, label }));
  const text: LayoutOption[] = used.has("text") ? [{ id: "text", label: "Text pages" }] : [];
  const other: LayoutOption[] = used.has("other") ? [{ id: "other", label: "Other pages" }] : [];
  return [...options, ...text, ...other];
}

/**
 * The pages and spreads with a page in layout, and the layout the filter is on: none (every one)
 * when layout is null or no longer among options.
 */
export function unitsInLayout(
  units: BookUnit[],
  options: LayoutOption[],
  layout: string | null,
): { filter: string | null; shown: BookUnit[] } {
  if (layout === null || !options.some((option) => option.id === layout)) {
    return { filter: null, shown: units };
  }
  return {
    filter: layout,
    shown: units.filter((unit) => unit.pages.some((page) => page.layout === layout)),
  };
}
