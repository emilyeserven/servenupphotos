import type { BuiltInLayout, CustomLayout, PhotoBook } from "@/lib/photo-book";
import { count } from "@portfolio/lib/words";

/**
 * The standard layouts file: layouts saved from one book's Layouts tab for every photo book to use,
 * and the built-in layouts hidden in every book.
 */
export interface StandardLayouts {
  /** Always `standard`: there's one file. */
  id: "standard";
  /** The standard layouts, in the order the Layouts tab lists them. */
  layouts: CustomLayout[];
  /** The built-in layouts hidden in every book, on top of the ones each book hides. */
  hiddenLayouts?: BuiltInLayout[];
}

/** The standard layouts file before anything is saved to it. */
export const EMPTY_STANDARD: StandardLayouts = { id: "standard", layouts: [] };

/** The first `custom-<n>` ID none of layouts has. */
function nextId(layouts: CustomLayout[]): CustomLayout["id"] {
  const ids = new Set(layouts.map((l) => l.id));
  let n = layouts.length + 1;
  while (ids.has(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

/** The standard layout a book's layout was saved as or added from, while it's still there. */
export function linkedStandard(
  file: StandardLayouts,
  layout: CustomLayout,
): CustomLayout | undefined {
  return layout.standard ? file.layouts.find((l) => l.id === layout.standard) : undefined;
}

/**
 * The file with the book's layout saved as a standard layout, replacing the one it's linked to when
 * that's still there, else as a new one, and the book with its layout linked to it.
 */
export function saveAsStandard(
  file: StandardLayouts,
  book: PhotoBook,
  layoutId: string,
): { file: StandardLayouts; book: PhotoBook } {
  const layout = book.layouts?.find((l) => l.id === layoutId);
  if (!layout) return { file, book };
  const { standard: _standard, ...look } = layout;
  const linked = linkedStandard(file, layout);
  const id = linked?.id ?? nextId(file.layouts);
  const saved = { ...look, id };
  const layouts = linked
    ? file.layouts.map((l) => (l.id === id ? saved : l))
    : [...file.layouts, saved];
  const bookLayouts = (book.layouts ?? []).map((l) =>
    l.id === layoutId ? { ...l, standard: id } : l,
  );
  return { file: { ...file, layouts }, book: { ...book, layouts: bookLayouts } };
}

/**
 * The book with a copy of the standard layout with ID id among its own layouts, linked to it, and
 * the copy's ID; the book as it was when there's no such standard layout.
 */
export function addStandard(
  book: PhotoBook,
  file: StandardLayouts,
  id: string,
): { book: PhotoBook; id?: CustomLayout["id"] } {
  const standard = file.layouts.find((l) => l.id === id);
  if (!standard) return { book };
  const own = book.layouts ?? [];
  const copy: CustomLayout = { ...standard, id: nextId(own), standard: id };
  return { book: { ...book, layouts: [...own, copy] }, id: copy.id };
}

/** The book's own layout linked to the standard layout with ID id, if it has one. */
export function copyOf(book: PhotoBook, id: string): CustomLayout | undefined {
  return book.layouts?.find((l) => l.standard === id);
}

/** The file without its standard layout with ID id; books keep their copies of it. */
export function removeStandard(file: StandardLayouts, id: string): StandardLayouts {
  return { ...file, layouts: file.layouts.filter((l) => l.id !== id) };
}

/** The file with the built-in layout id hidden in every book, or shown again. */
export function setHiddenEverywhere(
  file: StandardLayouts,
  id: BuiltInLayout,
  hide: boolean,
): StandardLayouts {
  const rest = (file.hiddenLayouts ?? []).filter((other) => other !== id);
  return { ...file, hiddenLayouts: hide ? [...rest, id] : rest };
}

/**
 * Under a layout's name on the Layouts tab: hidden in every book or in this one, and how many pages
 * have it, such as "Hidden from Photo Pages · on 2 pages" or "Not on any page".
 */
export function layoutRowNote(used: number, hidden: boolean, everywhere: boolean): string {
  const state = everywhere ? "Hidden in every book" : hidden ? "Hidden from Photo Pages" : "";
  if (!state) return used > 0 ? `On ${count(used, "page")}` : "Not on any page";
  return used > 0 ? `${state} · on ${count(used, "page")}` : state;
}
