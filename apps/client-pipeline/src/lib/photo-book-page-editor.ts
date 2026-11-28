import type { BookPage, PhotoBook } from "@/lib/photo-book";
import { isGeneratedPage } from "@/lib/photo-book-generated";
import { savedPageId } from "@/lib/photo-book-generated-pages";
import { isTextPage } from "@/lib/photo-book-text";

/** Whether the page has words to edit in the page editor: a text page, or a generated page such as the Places Index. */
export function isEditablePage(page: BookPage): boolean {
  return isTextPage(page) || isGeneratedPage(page);
}

/**
 * Where in the book's pages the page the editor opens for a page shown in the preview is: the page
 * itself, or for a page a generated page runs on to, the first one, which holds its options; -1
 * when there's no such page or it has nothing to edit.
 */
export function editablePageIndex(book: Pick<PhotoBook, "pages">, id: string): number {
  const saved = savedPageId(id);
  const index = book.pages.findIndex((page) => page.id === saved);
  const page = book.pages[index];
  return page && isEditablePage(page) ? index : -1;
}

/**
 * Which panel the Book tab shows beside its preview: Used page spreads in Preview Mode (collapsed
 * there), Edit mode's Photos drawer while it's on, the page editor while a page it can edit is open
 * in it, and otherwise Used page spreads.
 */
export function sidePanelShows(state: {
  previewMode: boolean;
  editMode: boolean;
  book: Pick<PhotoBook, "pages">;
  /** The ID of the page open in the page editor, if one is. */
  editingPage: string | null;
}): "used" | "drawer" | "editor" {
  if (state.previewMode) return "used";
  if (state.editMode) return "drawer";
  const open = state.editingPage !== null && editablePageIndex(state.book, state.editingPage) >= 0;
  return open ? "editor" : "used";
}
