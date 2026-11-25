import { TriangleAlertIcon } from "lucide-react";
import type { PhotoBook } from "@/lib/photo-book";
import {
  type BudgetMeterParts,
  type BudgetStatus,
  budgetMeterParts,
  budgetStatus,
} from "@/lib/photo-book-budget";
import { cn } from "@/lib/utils";
import { count } from "@portfolio/lib/words";

/** The bar's fill for each state: under the target, at or past it, past the max. */
const FILL: Record<BudgetStatus["state"], string> = {
  under: "bg-primary",
  reached: "bg-emerald-600",
  "over-max": "bg-red-600",
};

/**
 * On the Book tab, the pages placed in the book against its page budget: the count, how many
 * pages to go to each number, a bar up to the max (or the target when there's no max) with the
 * target marked, and a warning past the max. Nothing when the book has no budget.
 */
export function BudgetMeter({ book }: { book: PhotoBook }) {
  const status = budgetStatus(book);
  if (!status) return null;
  const parts = budgetMeterParts(status);
  return (
    <section aria-label="Page budget" className="flex flex-col gap-1.5 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{count(status.placed, "page")} placed</span>
        {parts.gaps.map((gap) => (
          <span key={gap} className="text-muted-foreground">
            {gap}
          </span>
        ))}
      </div>
      <BudgetBar parts={parts} status={status} />
      <OverMax pages={parts.overMax} />
    </section>
  );
}

/** The bar: the count's fill in its state's color, with the target's mark. */
function BudgetBar({ parts, status }: { parts: BudgetMeterParts; status: BudgetStatus }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={status.max ?? status.target ?? status.placed}
      aria-valuenow={status.placed}
      aria-label="Pages placed"
      className="bg-muted relative h-2 w-full max-w-xl rounded-full"
    >
      <div
        className={cn("h-full rounded-full transition-[width]", FILL[status.state])}
        style={{ width: `${parts.fill * 100}%` }}
      />
      {parts.tick !== null && (
        <span
          title={`Target, ${status.target}`}
          className="bg-foreground absolute -top-1 h-4 w-0.5 rounded"
          style={{ left: `calc(${parts.tick * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** The warning once the book has more pages than its max; nothing before. */
function OverMax({ pages }: { pages: number }) {
  if (pages === 0) return null;
  return (
    <p className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
      <TriangleAlertIcon className="size-3.5" />
      {count(pages, "page")} over the max. Take some out to fit the book.
    </p>
  );
}
