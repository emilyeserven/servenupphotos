import type { PageBudget, PhotoBook } from "@/lib/photo-book";
import { printedPages, unitsInBook } from "@/lib/photo-book-order";

/** The most pages a book can have, which a page budget can't go past (the backend's limit too). */
export const MAX_BUDGET_PAGES = 500;

/** How the pages placed in the book stand against its page budget. */
export interface BudgetStatus {
  /** The printed book's pages: a spread counts as two, and other pages and blank placeholders count too. */
  placed: number;
  /** The target, or null when none is set. */
  target: number | null;
  /** The max, or null when none is set. */
  max: number | null;
  /** Where the count is: under the target, at or past it (but not past the max), or past the max. */
  state: "under" | "reached" | "over-max";
}

/** A budget number as saved: a whole number from 1 to MAX_BUDGET_PAGES, or null for not set. */
function budgetNumber(n: number | undefined): number | null {
  return n !== undefined && Number.isInteger(n) && n > 0 && n <= MAX_BUDGET_PAGES ? n : null;
}

/** The pages placed in the book against its page budget; null when the book has no budget. */
export function budgetStatus(book: PhotoBook): BudgetStatus | null {
  const target = budgetNumber(book.budget?.target);
  const max = budgetNumber(book.budget?.max);
  if (target === null && max === null) return null;
  const placed = printedPages(unitsInBook(book)).length;
  const state =
    max !== null && placed > max
      ? "over-max"
      : target !== null && placed >= target
        ? "reached"
        : "under";
  return { placed, target, max, state };
}

/**
 * The page budget typed on the Info tab as it's saved, from the text in its Target and Max boxes,
 * or a sentence saying why it can't be. An empty box or 0 leaves that number out; both left out
 * is no budget.
 */
export function readBudget(target: string, max: string): PageBudget | undefined | string {
  const numbers = [target, max].map((text) => (text.trim() === "" ? 0 : Number(text)));
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > MAX_BUDGET_PAGES)) {
    return `Give the page budget as whole numbers from 0 to ${MAX_BUDGET_PAGES}.`;
  }
  const [t = 0, m = 0] = numbers;
  if (t > 0 && m > 0 && t > m) return "Make the target no more than the max.";
  if (t === 0 && m === 0) return undefined;
  return { ...(t > 0 && { target: t }), ...(m > 0 && { max: m }) };
}

/** What the Book tab says about one budget number: how many pages to go, or how many past it. */
function budgetGap(placed: number, goal: number, name: string): string {
  if (placed === goal) return `At the ${name}`;
  return placed < goal ? `${goal - placed} to the ${name}` : `${placed - goal} past the ${name}`;
}

/** How the Book tab draws a budget status: its words beside the count, and its bar. */
export interface BudgetMeterParts {
  /** How far the count is from each number set, such as "6 to the target (40)". */
  gaps: string[];
  /** How much of the bar the count fills, 0 to 1; the bar runs to the max, or the target without one. */
  fill: number;
  /** Where the target's mark goes along the bar, 0 to 1; null with no target. */
  tick: number | null;
  /** How many pages past the max the count is; 0 when it isn't past it. */
  overMax: number;
}

/** The words and bar of the Book tab's page budget for status. */
export function budgetMeterParts({ placed, target, max }: BudgetStatus): BudgetMeterParts {
  const scale = Math.max(max ?? target ?? 1, placed, 1);
  const gaps = [
    target === null ? null : `${budgetGap(placed, target, "target")} (${target})`,
    max === null ? null : `${budgetGap(placed, max, "max")} (${max})`,
  ].filter((gap) => gap !== null);
  return {
    gaps,
    fill: placed / scale,
    tick: target === null ? null : target / scale,
    overMax: max === null ? 0 : Math.max(0, placed - max),
  };
}

/** The text of the Info tab's Target and Max boxes for a saved budget; empty for one not set. */
export function budgetText(budget: PageBudget | undefined): { target: string; max: string } {
  return { target: String(budget?.target ?? ""), max: String(budget?.max ?? "") };
}
