import type { CombinedPhoto } from "@/lib/group-photos";
import { photoPixels } from "@/lib/photo-book-dpi";
import { checkPrint, type PrintCheck, type PrintRating, RATING_TEXT } from "@/lib/print-quality";
import { cn } from "@/lib/utils";
import { printChoice } from "@/stores/printing";

/** The colors of each rating's badge: green for excellent through red for poor. */
const RATING_CLASS: Record<PrintRating, string> = {
  excellent: "bg-green-500/15 text-green-700 dark:text-green-400",
  good: "bg-lime-500/15 text-lime-700 dark:text-lime-400",
  fair: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  poor: "bg-red-500/15 text-red-700 dark:text-red-400",
};

/** A photo's print resolution and its rating, such as "320 ppi · Excellent", as a colored badge. */
export function PrintRatingBadge({ check, className }: { check: PrintCheck; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        RATING_CLASS[check.rating],
        className,
      )}
    >
      {check.ppi} ppi · {RATING_TEXT[check.rating].label}
    </span>
  );
}

/**
 * The photo's original size in pixels and how it prints at the chosen size, re-checked whenever the
 * size changes; pixels is null when its JSON has no width and height, and check null without a size.
 */
export function usePrintCheck(photo: CombinedPhoto) {
  const choice = printChoice.use();
  const pixels = photoPixels(photo);
  const check = pixels ? checkPrint(pixels, choice.size, choice.fit) : null;
  return { choice, pixels, check };
}
