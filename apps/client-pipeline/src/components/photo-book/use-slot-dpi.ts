import { type RefObject, useEffect, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { photoPixels, printDpi } from "@/lib/photo-book-dpi";
import { currentData } from "@/lib/social-schedule";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { placeKey, usePrintResolutionStore } from "@/stores/print-resolution";

/** Marks the sheet a page is drawn on, which a photo place measures itself against. */
export const PAGE_SHEET_ATTRIBUTE = "data-page-sheet";

/** The width of the page sheet that holds element, kept up to date as it resizes. */
function useSheetWidth(element: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const sheet = element.current?.closest<HTMLElement>(`[${PAGE_SHEET_ATTRIBUTE}]`);
    if (!sheet) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

/** Where a photo place is and what it holds, to work out its printed resolution. */
interface SlotPrint {
  /** The place's element, inside its page's sheet. */
  element: RefObject<HTMLElement | null>;
  /** Its size on the screen. */
  box: { width: number; height: number };
  /** The page's printed width in inches; null for a page size in pixels. */
  inches: number | null;
  /** The ID of the page the place is on, and its place on it. */
  page: string;
  slot: number;
  /** The photo file's path, and the photo when the page can find it. */
  photo: string;
  file: SocialPhoto | undefined;
}

/**
 * The photo's printed resolution in its place, in dots per inch, also kept for the Book tab's list
 * of low-resolution photos; null until it's measured, or with no printed size or no photo size.
 */
export function useSlotDpi({ element, box, inches, page, slot, photo, file }: SlotPrint) {
  const sheet = useSheetWidth(element);
  const changed = useChangedPhotoFiles();
  const pixels = photoPixels(file && currentData(file, changed));
  const dpi = pixels && inches !== null ? printDpi(pixels, box, sheet, inches) : null;
  const setPlace = usePrintResolutionStore((state) => state.setPlace);
  useEffect(() => {
    if (dpi !== null) setPlace(placeKey(page, slot), { photo, dpi });
  }, [dpi, page, slot, photo, setPlace]);
  return dpi;
}
