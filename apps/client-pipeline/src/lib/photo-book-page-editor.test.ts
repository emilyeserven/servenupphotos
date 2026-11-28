import assert from "node:assert/strict";
import { test } from "node:test";
import type { BookPage, PhotoBook } from "@/lib/photo-book";
import { withRunOnPages } from "@/lib/photo-book-generated-pages";
import { editablePageIndex, isEditablePage, sidePanelShows } from "@/lib/photo-book-page-editor";

/** A photo page, a text page, a three-page Places Index and an other page. */
function book(): Pick<PhotoBook, "pages"> {
  const page = (id: string, extra: Partial<BookPage>): BookPage => ({
    id,
    layout: "full",
    title: null,
    slots: [],
    ...extra,
  });
  return {
    pages: [
      page("photo", { slots: [{ photo: "a", caption: null }] }),
      page("text", { layout: "text", title: "", text: "Hi" }),
      page("index", { layout: "other", generated: { kind: "places-index", pages: 3 } }),
      page("other", { layout: "other", name: "Bio" }),
    ],
  };
}

test("text and generated pages can be edited, photo and plain other pages can't", () => {
  const [photo, text, index, other] = book().pages as BookPage[];
  assert.equal(isEditablePage(photo as BookPage), false);
  assert.equal(isEditablePage(text as BookPage), true);
  assert.equal(isEditablePage(index as BookPage), true);
  assert.equal(isEditablePage(other as BookPage), false);
});

test("a text page opens itself", () => {
  assert.equal(editablePageIndex(book(), "text"), 1);
});

test("every page a generated page runs on to opens the first one", () => {
  const index = book().pages[2] as BookPage;
  const ids = withRunOnPages(index).map((page) => page.id);
  assert.equal(ids.length, 3);
  for (const id of ids) assert.equal(editablePageIndex(book(), id), 2);
});

test("a photo page, a plain other page or a missing one opens nothing", () => {
  assert.equal(editablePageIndex(book(), "photo"), -1);
  assert.equal(editablePageIndex(book(), "other"), -1);
  assert.equal(editablePageIndex(book(), "gone"), -1);
});

test("the page editor shows beside the preview only outside Preview Mode and Edit mode", () => {
  const state = { previewMode: false, editMode: false, book: book(), editingPage: "text" };
  assert.equal(sidePanelShows(state), "editor");
  assert.equal(sidePanelShows({ ...state, editMode: true }), "drawer");
  assert.equal(sidePanelShows({ ...state, previewMode: true, editMode: true }), "used");
});

test("Used page spreads show with no page open, or one that can't be edited any more", () => {
  const state = { previewMode: false, editMode: false, book: book(), editingPage: null };
  assert.equal(sidePanelShows(state), "used");
  assert.equal(sidePanelShows({ ...state, editingPage: "gone" }), "used");
  assert.equal(sidePanelShows({ ...state, editingPage: "photo" }), "used");
});
