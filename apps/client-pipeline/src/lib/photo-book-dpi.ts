import { type BookPage, type BookSize, DEFAULT_SIZE, type PhotoBook } from "@/lib/photo-book";
import { pageNumbers, unitsInBook } from "@/lib/photo-book-order";

/** The resolution a printed photo needs to look sharp: 300 dots (pixels) per inch. */
export const PRINT_DPI = 300;

/** How many of each page size unit make an inch; none for pixels, which have no printed size. */
const PER_INCH: Record<Exclude<BookSize["unit"], "px">, number> = {
  in: 1,
  cm: 2.54,
  mm: 25.4,
  pt: 72,
};

/** The book's page width in inches, or null when its size is in pixels and so has no printed size. */
export function pageWidthInches(book: Pick<PhotoBook, "size">): number | null {
  const { width, unit } = book.size ?? DEFAULT_SIZE;
  if (unit === "px" || width <= 0) return null;
  return width / PER_INCH[unit];
}

/** A size in pixels. */
interface Pixels {
  width: number;
  height: number;
}

/**
 * The photo's printed resolution, in dots per inch, in a place of size box on a page drawn sheet
 * pixels wide that prints inches wide. The photo is cropped to cover the place, so the side that
 * fills it sets the scale. Null when anything isn't known yet.
 */
export function printDpi(photo: Pixels, box: Pixels, sheet: number, inches: number): number | null {
  if ([photo.width, photo.height, box.width, box.height, sheet, inches].some((n) => !(n > 0))) {
    return null;
  }
  const scale = Math.max(box.width / photo.width, box.height / photo.height);
  const printedWidth = ((photo.width * scale) / sheet) * inches;
  return Math.round(photo.width / printedWidth);
}

/** The original's pixel size from its photo JSON, or null when the JSON has none. */
export function photoPixels(data: unknown): Pixels | null {
  if (typeof data !== "object" || data === null) return null;
  const { width, height } = data as { width?: unknown; height?: unknown };
  return typeof width === "number" && typeof height === "number" ? { width, height } : null;
}

/** A photo in the book too small to print sharp in its place. */
export interface LowPhoto {
  /** The ID of the page or spread it's on, to show it. */
  unit: string;
  /** The page's number in the book, and the page. */
  number: number;
  page: BookPage;
  /** The photo file's path. */
  photo: string;
  dpi: number;
}

/**
 * The photos in the book, in its order, whose places were measured below PRINT_DPI, from places
 * by `<page ID>:<slot>` (the photo there when measured, and its resolution).
 */
export function lowResolution(
  book: PhotoBook,
  places: Map<string, { photo: string; dpi: number }>,
): LowPhoto[] {
  const numbers = pageNumbers(book);
  return unitsInBook(book).flatMap((unit) =>
    unit.pages.flatMap((page) =>
      page.slots.flatMap((slot, i) => {
        const measured = places.get(`${page.id}:${i}`);
        if (!slot.photo || measured?.photo !== slot.photo || measured.dpi >= PRINT_DPI) return [];
        const number = numbers.get(page.id) ?? 0;
        return [{ unit: unit.id, number, page, photo: slot.photo, dpi: measured.dpi }];
      }),
    ),
  );
}
