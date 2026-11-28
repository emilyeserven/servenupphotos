import type { BookPage } from "@/lib/photo-book";

/** The most pages one generated page can run on across. */
export const MAX_GENERATED_PAGES = 20;

/** What a page the generated page runs on to has after its ID, before its number, 2 for the second. */
const PART = "~part-";

/** How many pages the generated page runs on across, linked: 1 to MAX_GENERATED_PAGES, 1 when none is set or it isn't generated. */
export function generatedPageCount(page: Pick<BookPage, "generated">): number {
  const n = Math.round(page.generated?.pages ?? 1);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_GENERATED_PAGES) : 1;
}

/**
 * The page, and for a generated page that runs on across more than one, the pages it runs on to,
 * each a copy with its own ID (`<ID>~part-2`, …). They're drawn and numbered as pages of the book,
 * but only the first is saved; the others go wherever it goes.
 */
export function withRunOnPages(page: BookPage): BookPage[] {
  const count = generatedPageCount(page);
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? page : { ...page, id: `${page.id}${PART}${i + 1}` },
  );
}

/** Which of its generated page's pages the page is, 0 for the first (the saved one). */
export function generatedPart(page: Pick<BookPage, "id">): number {
  const at = page.id.lastIndexOf(PART);
  const n = at < 0 ? NaN : Number(page.id.slice(at + PART.length));
  return Number.isInteger(n) && n > 1 ? n - 1 : 0;
}

/** The ID of the saved page a page is drawn from: its own, or for a page a generated page runs on to, the first page's. */
export function savedPageId(id: string): string {
  const at = id.lastIndexOf(PART);
  return at < 0 ? id : id.slice(0, at);
}
