import type { FilterOption } from "@portfolio/lib/filter-options";

/** A photo book a photo was placed in, as the pipeline's Photo Book page keeps them. */
export interface BookRef {
  /** The book's ID, such as "2026". */
  id: string;
  /** What the Photo Book page calls it, such as "Korea 2026". */
  name: string;
}

/** Whether the photo is on a page of the photo book with the ID. */
export function inBook(photo: { books?: BookRef[] }, value: string): boolean {
  return (photo.books ?? []).some((book) => book.id === value);
}

/**
 * The Book filter's choices: each photo book any of `facet` is placed in, A to Z, with how many of
 * those photos it has. None when no photo says which books it's in, as on the portfolio, which
 * doesn't read the photo books.
 */
export function bookOptions(facet: { books?: BookRef[] }[]): FilterOption[] {
  const books = new Map<string, FilterOption>();
  for (const photo of facet) {
    for (const { id, name } of photo.books ?? []) {
      const option = books.get(id) ?? {
        key: "book",
        value: id,
        label: { english: name, romanized: name, phonetic: name, native: name },
        depth: 0,
        count: 0,
      };
      option.count += 1;
      books.set(id, option);
    }
  }
  return [...books.values()].toSorted((a, b) => a.label.english.localeCompare(b.label.english));
}
