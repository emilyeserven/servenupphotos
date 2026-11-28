import { standardLayoutsFile } from "@/api/standard-layouts";
import type { PageLayout, PhotoBook } from "@/lib/photo-book";
import { type LayoutChoice, layoutChoices } from "@/lib/photo-book-layouts";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The layouts a page's picker in book offers (see layoutChoices), leaving out the built-in ones
 * hidden in every book as well as the ones the book hides, though a page keeps its current one.
 */
export function usePickerLayouts(book: PhotoBook): (current?: PageLayout) => LayoutChoice[] {
  const { data } = useCombinedData();
  const everywhere = standardLayoutsFile(data).hiddenLayouts ?? [];
  return (current) => layoutChoices(book, current, everywhere);
}
