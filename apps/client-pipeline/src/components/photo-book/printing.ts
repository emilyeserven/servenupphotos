import { createContext, useContext } from "react";
import type { BoxSize } from "@/lib/photo-book-image";

/** True inside the pages drawn for **Save as PDF**, which load sharper photos and load them at once. */
export const PrintingContext = createContext(false);

/** Whether the page is being drawn for **Save as PDF**. */
function usePrinting(): boolean {
  return useContext(PrintingContext);
}

/** How many times wider than drawn a photo is loaded for **Save as PDF**: 96 CSS pixels an inch, times 3, is about 300 dpi. */
const PRINT_SCALE = 3;

/**
 * The size to pick a photo's version for, drawn size: PRINT_SCALE times as large for **Save as
 * PDF**; and how it loads: at once for the PDF, or once it's near the screen.
 */
export function usePrintedSize(size: BoxSize): { box: BoxSize; loading: "eager" | "lazy" } {
  if (!usePrinting()) return { box: size, loading: "lazy" };
  return {
    box: { width: size.width * PRINT_SCALE, height: size.height * PRINT_SCALE },
    loading: "eager",
  };
}
