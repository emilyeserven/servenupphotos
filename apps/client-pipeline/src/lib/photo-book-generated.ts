import { type BookPage, type PhotoBook, newPage } from "@/lib/photo-book";
import { generatedPageCount } from "@/lib/photo-book-generated-pages";
import { addToBook, bookOrder } from "@/lib/photo-book-order";

/** What a generated page is made from: for now, the places the book's photos show. */
export type GeneratedKind = "places-index";

/** How a generated page writes names: see GeneratedPage's `names`. */
export type NameStyle = "romanized" | "romanizedLocal" | "localRomanized" | "local";

/** The most specific level a Places Index lists: countries, states, cities, or every place (absent). */
export type IndexDepth = "country" | "state" | "city";

/**
 * A page drawn from the book's own data each time it's shown, so it stays current as photos and
 * pages change, and its options. It's one of the book's other pages.
 */
export interface GeneratedPage {
  kind: GeneratedKind;
  /**
   * How names are written, from their localizations: in Latin letters (`romanized`), with their own
   * script after (`romanizedLocal`, Gyeongbokgung (경복궁)) or before (`localRomanized`, 경복궁
   * (Gyeongbokgung)), or in their own script only (`local`); absent for the name as photos and
   * places have it.
   */
  names?: NameStyle;
  /** True in a page saved before `names`, for `localRomanized`; read once, then saved as `names`. */
  localized?: boolean;
  /** True to write US states in their standard abbreviation, such as CA for California. */
  stateAbbreviations?: boolean;
  /** The most specific level listed; absent for every place. */
  depth?: IndexDepth;
  /** `book` to list places in the order the book first shows them; absent for alphabetical order. */
  order?: "book";
  /** How many columns the page flows into, 2 or 3; absent for one. */
  columns?: number;
  /**
   * How many pages it runs on across, linked so they go in the book together, 2 to 20; absent for
   * one. Only the first is saved; the others are drawn after it.
   */
  pages?: number;
  /**
   * The entries left out, their places lifted into the entry above, such as `city:Seoul` or
   * `place:<place ID>`; absent for none.
   */
  hidden?: string[];
}

/** A kind of generated page, as the Book tab's **Generate page** menu offers it. */
interface GeneratedKindInfo {
  kind: GeneratedKind;
  /** What the menu and the new page call it, such as "Places Index". */
  name: string;
  /** The heading the new page starts with. */
  title: string;
  /** What it shows, in a sentence. */
  help: string;
}

/** Every kind of page the Book tab can generate, in the order its menu lists them. */
export const GENERATED_KINDS: GeneratedKindInfo[] = [
  {
    kind: "places-index",
    name: "Places Index",
    title: "Places",
    help: "Every place the book's photos show, by country, state and city.",
  },
];

/** The kind's menu entry; the first one for a kind this version doesn't know. */
export function generatedKind(kind: GeneratedKind): GeneratedKindInfo {
  return (
    GENERATED_KINDS.find((info) => info.kind === kind) ?? (GENERATED_KINDS[0] as GeneratedKindInfo)
  );
}

/** The most columns a generated page flows into. */
export const GENERATED_COLUMNS = 3;

/** Whether the page is a generated page. */
export function isGeneratedPage(page: BookPage): page is BookPage & { generated: GeneratedPage } {
  return page.layout === "other" && page.generated !== undefined;
}

/** The book with a new generated page of kind, named and titled after it, added at the end of the book. */
export function addGeneratedPage(book: PhotoBook, kind: GeneratedKind): PhotoBook {
  const info = generatedKind(kind);
  const page: BookPage = {
    ...newPage(book, "other"),
    name: info.name,
    title: info.title,
    generated: { kind },
  };
  return addToBook({ ...book, order: bookOrder(book), pages: [...book.pages, page] }, page.id);
}

/** How many columns the generated page flows into: 1 to GENERATED_COLUMNS, 1 when none is set. */
export function generatedColumns(generated: Pick<GeneratedPage, "columns">): number {
  const n = Math.round(generated.columns ?? 1);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), GENERATED_COLUMNS) : 1;
}

/** The options with columns from 1 to GENERATED_COLUMNS, one left out, and empty ones left out. */
function tidy(generated: GeneratedPage): GeneratedPage {
  const out: GeneratedPage = { ...generated };
  const columns = generatedColumns(out);
  if (columns === 1) delete out.columns;
  else out.columns = columns;
  const pages = generatedPageCount({ generated: out });
  if (pages === 1) delete out.pages;
  else out.pages = pages;
  if (!out.hidden?.length) delete out.hidden;
  if (out.localized && !out.names) out.names = "localRomanized";
  delete out.localized;
  for (const key of ["names", "stateAbbreviations", "depth", "order"] as const) {
    if (!out[key]) delete out[key];
  }
  return out;
}

/** The book with the generated page with ID id's options changed by change; other pages as they are. */
export function changeGenerated(
  book: PhotoBook,
  id: string,
  change: (generated: GeneratedPage) => GeneratedPage,
): PhotoBook {
  return {
    ...book,
    pages: book.pages.map((page) =>
      page.id === id && page.generated
        ? { ...page, generated: tidy(change(page.generated)) }
        : page,
    ),
  };
}

/** The book with the page with ID id's heading set to title; "" leaves it without one. */
export function setGeneratedTitle(book: PhotoBook, id: string, title: string): PhotoBook {
  return {
    ...book,
    pages: book.pages.map((page) => (page.id === id ? { ...page, title } : page)),
  };
}
