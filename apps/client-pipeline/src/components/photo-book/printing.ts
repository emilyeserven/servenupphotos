import { createContext, useContext } from "react";
import type { BoxSize } from "@/lib/photo-book-image";

/** True inside the pages drawn for **Save as PDF**, which ask for sharper photos. */
export const PrintingContext = createContext(false);

/** Whether the page is being drawn for **Save as PDF**. */
function usePrinting(): boolean {
  return useContext(PrintingContext);
}

/** How many times wider than drawn a photo is loaded for **Save as PDF**: 96 CSS pixels an inch, times 3, is about 300 dpi. */
const PRINT_SCALE = 3;

/**
 * The size to pick a photo's version for, drawn size: PRINT_SCALE times as large for **Save as
 * PDF**. The photos load once they're near the screen, so the pages drawn out of sight for the PDF
 * load none here: the backend's Chrome loads them.
 */
export function usePrintedSize(size: BoxSize): BoxSize {
  if (!usePrinting()) return size;
  return { width: size.width * PRINT_SCALE, height: size.height * PRINT_SCALE };
}
