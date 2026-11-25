import { ArrowDownWideNarrowIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { count } from "@portfolio/lib/words";

interface BookOrderControlsProps {
  /** How many photo pages and spreads are in the book. */
  inBook: number;
  /** Whether the photo pages are already in the book's order. */
  sorted: boolean;
  onSort: () => void;
  /** Whether the pages and spreads in the book are shown. */
  showInBook: boolean;
  onShowInBook: (on: boolean) => void;
}

/**
 * Beside the Photo Pages views: **Sort by book order**, which puts the photo pages in the order
 * the Book tab has them, the ones not in the book after, and **Show pages in the book**, on to
 * start, which can hide the ones already in it. Nothing while none is in the book.
 */
export function BookOrderControls(props: BookOrderControlsProps) {
  const { inBook, sorted, onSort, showInBook, onShowInBook } = props;
  if (inBook === 0) return null;
  return (
    <>
      <Button size="sm" variant="outline" disabled={sorted} onClick={onSort}>
        <ArrowDownWideNarrowIcon />
        {sorted ? "In book order" : "Sort by book order"}
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={showInBook}
          onChange={(event) => onShowInBook(event.target.checked)}
        />
        Show pages in the book ({count(inBook, "page or spread", "pages or spreads")})
      </label>
    </>
  );
}
